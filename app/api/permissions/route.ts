import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function isAdminUser(user: { email?: string | null; user_metadata?: unknown; app_metadata?: unknown } | null): boolean {
  if (!user) return false;
  return Boolean(
    (user.user_metadata as { role?: string } | null)?.role === 'admin' ||
    (user.app_metadata as { role?: string } | null)?.role === 'admin' ||
    (process.env.ADMIN_EMAILS &&
      user.email &&
      process.env.ADMIN_EMAILS.split(',')
        .map((e) => e.trim())
        .includes(user.email))
  );
}

/** GET: 전체 사용자 목록 + 각 사용자별 메뉴 권한 (admin 전용) */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: '관리자만 조회할 수 있습니다.' }, { status: 403 });

    const [profilesRes, menusRes, permsRes] = await Promise.all([
      supabase.from('user_profiles').select('email, display_name').order('email'),
      supabase.from('menus').select('id, path, label, sort_order').order('sort_order', { ascending: true }),
      supabase.from('user_menu_permissions').select('email, menu_id'),
    ]);

    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (menusRes.error) throw new Error(menusRes.error.message);
    if (permsRes.error) throw new Error(permsRes.error.message);

    const menus = (menusRes.data ?? []) as { id: string; path: string; label: string; sort_order: number }[];
    const perms = (permsRes.data ?? []) as { email: string; menu_id: string }[];
    const permsByEmail = new Map<string, Set<string>>();
    for (const p of perms) {
      let set = permsByEmail.get(p.email);
      if (!set) {
        set = new Set();
        permsByEmail.set(p.email, set);
      }
      set.add(p.menu_id);
    }

    const users = (profilesRes.data ?? []).map((row: { email: string; display_name: string }) => ({
      email: row.email,
      displayName: row.display_name,
      menuIds: Array.from(permsByEmail.get(row.email) ?? []),
    }));

    return NextResponse.json({ users, menus });
  } catch (e) {
    const message = e instanceof Error ? e.message : '권한 조회 중 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT: 사용자별 메뉴 권한 저장 (admin 전용) */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const menuIds = Array.isArray(body.menuIds) ? body.menuIds.filter((id: unknown): id is string => typeof id === 'string') : [];

    if (!email) return NextResponse.json({ error: 'email이 필요합니다.' }, { status: 400 });

    const { error: delError } = await supabase.from('user_menu_permissions').delete().eq('email', email);
    if (delError) throw new Error(delError.message);

    if (menuIds.length > 0) {
      const rows = menuIds.map((menu_id) => ({ email, menu_id }));
      const { error: insError } = await supabase.from('user_menu_permissions').insert(rows);
      if (insError) throw new Error(insError.message);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '권한 저장 중 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST: 신규 사용자 추가 (admin 전용) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: '관리자만 추가할 수 있습니다.' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

    if (!email) return NextResponse.json({ error: 'email이 필요합니다.' }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: 'displayName이 필요합니다.' }, { status: 400 });

    const { error } = await supabase.from('user_profiles').upsert(
      { email, display_name: displayName },
      { onConflict: 'email' }
    );
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '사용자 추가 중 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
