import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({
            name,
            value,
            ...options,
            httpOnly: options.httpOnly ?? false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: options.sameSite ?? 'lax',
            path: options.path ?? '/',
          });
        } catch {
          console.warn('[Auth] Failed to set cookie in Server Component:', name);
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        } catch {
          console.warn('[Auth] Failed to remove cookie in Server Component:', name);
        }
      },
    },
  });
}

export async function getUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const session = await getSession();
    if (!session) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function getSession() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000;
      if (Date.now() >= expiresAt) return null;
    }
    return session;
  } catch {
    return null;
  }
}
