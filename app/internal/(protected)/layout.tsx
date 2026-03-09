import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDisplayName } from '@/lib/user-profiles';
import { SessionMonitor } from './components/SessionMonitor';
import { LogoutButton } from './components/LogoutButton';
import { ModalProvider } from '@/lib/components/ModalProvider';

function getNavItems(isAdmin: boolean) {
  const items = [
    { label: '거래처 현황(마감기준)', href: '/internal/report', icon: '📄', adminOnly: false },
    { label: '거래처 매출 대시보드', href: '/internal/dashboard', icon: '📊', adminOnly: false },
    { label: '설정', href: '/internal/sync', icon: '⚙️', adminOnly: true },
  ];
  return items.filter((item) => !item.adminOnly || isAdmin);
}

async function getAuthenticatedUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return null;
    if (session.expires_at && Date.now() >= session.expires_at * 1000) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const isAdmin =
      (user.user_metadata?.role === 'admin') ||
      (user.app_metadata?.role === 'admin') ||
      (process.env.ADMIN_EMAILS && user.email
        ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim()).includes(user.email)
        : false);
    return { user, isAdmin };
  } catch (error) {
    console.error('[Auth] getAuthenticatedUser:', error);
    return null;
  }
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getAuthenticatedUser();
  if (!auth) redirect('/internal/login');

  const { user, isAdmin } = auth;
  const navItems = getNavItems(isAdmin);
  const displayName = await getDisplayName(user.email) ?? user.email ?? '사용자';

  return (
    <ModalProvider>
      <SessionMonitor />
      <div className="flex min-h-screen bg-gray-50">
        <aside className="print-hide w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen fixed">
          <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
            <Link href="/internal/report" className="flex items-center gap-3">
              <Image
                src="/ne-ci-logo.png"
                alt="NE능률"
                width={52}
                height={36}
                className="object-contain shrink-0"
                priority
              />
              <span className="font-bold text-gray-900 text-sm">ELT SAP 데이터</span>
            </Link>
          </div>
          <nav className="flex-1 py-4 overflow-y-auto">
            <ul className="space-y-1 px-3">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-4 border-t border-gray-200 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-medium text-sm">
                  {(displayName ?? 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </aside>
        <main className="flex-1 overflow-auto ml-64 p-6">{children}</main>
      </div>
    </ModalProvider>
  );
}
