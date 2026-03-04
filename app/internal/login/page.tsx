'use client';

import { useState, useCallback } from 'react';
import { getClientSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        setError('Supabase 설정이 올바르지 않습니다. 환경 변수를 확인해주세요.');
        setIsLoading(false);
        return;
      }

      const supabase = getClientSupabase();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        let errorMessage = authError.message;
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('Invalid login')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (authError.message.includes('Email not confirmed')) {
          errorMessage = '이메일 인증이 완료되지 않았습니다.';
        } else if (authError.status === 400) {
          errorMessage = '로그인 정보를 확인해주세요.';
        } else if (authError.message.includes('rate limit')) {
          errorMessage = '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
        }
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (!data.session) {
        setError('세션을 생성할 수 없습니다. 다시 시도해주세요.');
        setIsLoading(false);
        return;
      }

      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          const syncResponse = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          });
          if (!syncResponse.ok) {
            const errorData = await syncResponse.json();
            console.error('Session sync failed:', errorData);
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
          window.location.href = '/internal';
        } catch (syncError) {
          console.error('Session sync error:', syncError);
          await new Promise((resolve) => setTimeout(resolve, 200));
          window.location.href = '/internal';
        }
      } else {
        setError('세션 토큰을 가져올 수 없습니다. 다시 시도해주세요.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof Error && err.message.includes('message channel')) {
        try {
          const supabase = getClientSupabase();
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            window.location.href = '/internal';
            return;
          }
        } catch {
          // ignore
        }
      }
      setError('로그인 중 오류가 발생했습니다. 관리자에게 문의해주세요.');
      setIsLoading(false);
    }
  }, [email, password, isLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ELT 총판 현황</h1>
            <p className="text-gray-600 mt-2">내부 대시보드 로그인</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="staff@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '처리 중...' : '로그인'}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            계정이 필요합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
