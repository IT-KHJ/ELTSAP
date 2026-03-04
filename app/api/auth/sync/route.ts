import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Access token and refresh token required' },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error || !session) {
      return NextResponse.json(
        { error: 'Failed to set session', details: error?.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: session.user.id, email: session.user.email },
    });
  } catch (error) {
    console.error('[Auth Sync] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
