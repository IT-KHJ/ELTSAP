import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserMenuPermissions } from '@/lib/menu-permissions';

export default async function InternalIndexPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/internal/login');
  const isAdmin =
    (user.user_metadata?.role === 'admin') ||
    (user.app_metadata?.role === 'admin') ||
    (process.env.ADMIN_EMAILS && user.email
      ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).includes(user.email)
      : false);
  const allowedPaths = await getUserMenuPermissions(user.email, isAdmin);
  const first = allowedPaths[0];
  redirect(first ?? '/internal/unauthorized');
}
