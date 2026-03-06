'use client';

import { useRouter } from 'next/navigation';
import { getClientSupabase } from '@/lib/supabase/client';
import { useModal } from '@/lib/components/ModalProvider';
import { PowerIcon } from './PowerIcon';

export function LogoutButton() {
  const router = useRouter();
  const modal = useModal();

  const handleLogout = async () => {
    const confirmed = await modal.open({
      type: 'confirm',
      message: '로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      cancelText: '취소',
    });
    if (confirmed) {
      try {
        const supabase = getClientSupabase();
        await supabase.auth.signOut();
        router.push('/internal/login');
        router.refresh();
      } catch (error) {
        console.error('Logout error:', error);
        await modal.open({ type: 'error', message: '로그아웃 중 오류가 발생했습니다.' });
      }
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-left"
    >
      <span className="flex items-center gap-2">
        <PowerIcon className="w-5 h-5 shrink-0" />
        <span>로그아웃</span>
      </span>
    </button>
  );
}
