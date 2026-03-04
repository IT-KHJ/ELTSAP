import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SessionMonitor } from './components/SessionMonitor';
import { LogoutButton } from './components/LogoutButton';
import { ModalProvider } from '@/lib/components/ModalProvider';

const navItems = [
  { label: '대시보드', href: '/internal', icon: '📊' },
  { label: '거래처 현황 보고서', href: '/internal/report', icon: '📄' },
  { label: '동기화', href: '/internal/sync', icon: '🔄' },
];

async function getAuthenticatedUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) return null;
    if (session.expires_at && Date.now() >= session.expires_at * 1000) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user };
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

  const { user } = auth;

  return (
    <ModalProvider>
      <SessionMonitor />
      <div className="flex min-h-screen bg-gray-50">
        <aside className="print-hide w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen fixed">
          <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
            <Link href="/internal" className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <span className="font-bold text-gray-900">ELT 총판 현황</span>
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
                  {(user.email ?? 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.email ?? '사용자'}
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
