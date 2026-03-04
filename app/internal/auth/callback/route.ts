import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/internal/login?error=no_code', requestUrl.origin));
  }

  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.redirect(new URL('/internal/login?error=config_error', requestUrl.origin));
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            console.error('[Auth Callback] Failed to set cookies:', error);
          }
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL('/internal/login?error=auth_failed', requestUrl.origin));
    }

    if (!data.session) {
      return NextResponse.redirect(new URL('/internal/login?error=no_session', requestUrl.origin));
    }

    return NextResponse.redirect(new URL('/internal', requestUrl.origin));
  } catch (error) {
    console.error('[Auth Callback] Exception:', error);
    return NextResponse.redirect(new URL('/internal/login?error=callback_error', requestUrl.origin));
  }
}
