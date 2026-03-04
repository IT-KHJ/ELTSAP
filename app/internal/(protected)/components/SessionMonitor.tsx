'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClientSupabase } from '@/lib/supabase/client';
import { useModal } from '@/lib/components/ModalProvider';

const SESSION_TIMEOUT = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL = 60 * 1000;
const IDLE_TIMEOUT = 15 * 60 * 1000;

export function SessionMonitor() {
  const router = useRouter();
  const modal = useModal();
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  useEffect(() => {
    const supabase = getClientSupabase();

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      warningShownRef.current = false;
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          router.push('/internal/login');
          return;
        }
        const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
        const now = Date.now();
        if (expiresAt && now >= expiresAt) {
          await supabase.auth.signOut();
          router.push('/internal/login');
          return;
        }
        const idleTime = now - lastActivityRef.current;
        if (idleTime >= IDLE_TIMEOUT && !warningShownRef.current) {
          warningShownRef.current = true;
          const minutes = Math.floor((SESSION_TIMEOUT - idleTime) / 60000);
          const confirmed = await modal.open({
            type: 'confirm',
            message: `세션이 곧 만료됩니다. (${minutes}분 남음)\n계속 사용하시겠습니까?`,
            confirmText: '계속 사용',
            cancelText: '로그아웃',
          });
          if (confirmed) {
            try {
              await supabase.auth.refreshSession();
              lastActivityRef.current = Date.now();
              warningShownRef.current = false;
            } catch {
              await supabase.auth.signOut();
              router.push('/internal/login');
            }
          } else {
            await supabase.auth.signOut();
            router.push('/internal/login');
          }
        }
        if (idleTime >= SESSION_TIMEOUT) {
          await supabase.auth.signOut();
          router.push('/internal/login');
        }
      } catch (error) {
        console.error('[SessionMonitor] Error:', error);
      }
    };

    const intervalId = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    checkSession();
    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((event) => window.removeEventListener(event, updateActivity));
    };
  }, [router, modal]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const supabase = getClientSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/internal/login');
        } else {
          try {
            await supabase.auth.refreshSession();
          } catch (error) {
            console.error('[SessionMonitor] Refresh on visibility failed:', error);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router]);

  return null;
}
