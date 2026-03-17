/**
 * 사용자별 메뉴 권한 조회
 * user_profiles + user_menu_permissions 기반
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

const DEFAULT_PATHS = ['/internal/report', '/internal/dashboard'];

/** 모든 메뉴 path 목록 (정렬 순) */
export async function getAllMenuPaths(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('menus')
    .select('path')
    .order('sort_order', { ascending: true });
  if (error || !data?.length) return [...DEFAULT_PATHS, '/internal/sales-status', '/internal/sales-status-b', '/internal/sync', '/internal/permissions'];
  return data.map((r) => r.path as string);
}

/**
 * 사용자 email 기준으로 접근 가능한 menu path 목록 반환
 * @param email 사용자 이메일
 * @param isAdmin admin이면 모든 메뉴 반환
 */
export async function getUserMenuPermissions(email: string, isAdmin: boolean): Promise<string[]> {
  if (!email?.trim()) return [];
  if (isAdmin) return getAllMenuPaths();

  const supabase = await createServerSupabaseClient();
  const { data: permData, error: permError } = await supabase
    .from('user_menu_permissions')
    .select('menu_id')
    .eq('email', email.trim());
  if (permError || !permData?.length) return DEFAULT_PATHS;

  const menuIds = permData.map((r) => r.menu_id as string);
  const { data: menuData, error: menuError } = await supabase
    .from('menus')
    .select('path')
    .in('id', menuIds)
    .order('sort_order', { ascending: true });
  if (menuError || !menuData?.length) return DEFAULT_PATHS;

  return menuData.map((r) => r.path as string);
}
