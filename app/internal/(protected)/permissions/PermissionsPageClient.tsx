'use client';

import { useState, useEffect, useCallback } from 'react';

interface Menu {
  id: string;
  path: string;
  label: string;
  sort_order: number;
}

interface UserWithPerms {
  email: string;
  displayName: string;
  menuIds: string[];
}

export default function PermissionsPageClient() {
  const [users, setUsers] = useState<UserWithPerms[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<string, string[]>>({});
  const [addEmail, setAddEmail] = useState('');
  const [addDisplayName, setAddDisplayName] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/permissions');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setMenus(data.menus ?? []);
      const perms: Record<string, string[]> = {};
      for (const u of data.users ?? []) {
        perms[u.email] = [...(u.menuIds ?? [])];
      }
      setLocalPerms(perms);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave(email: string) {
    setSaving(email);
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, menuIds: localPerms[email] ?? [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(null);
    }
  }

  function toggleMenu(email: string, menuId: string) {
    setLocalPerms((prev) => {
      const arr = prev[email] ?? [];
      const next = arr.includes(menuId) ? arr.filter((id) => id !== menuId) : [...arr, menuId];
      return { ...prev, [email]: next };
    });
  }

  async function handleAddUser() {
    if (!addEmail.trim() || !addDisplayName.trim()) {
      setAddMsg({ ok: false, msg: '이메일과 표시명을 입력하세요.' });
      return;
    }
    setAddSaving(true);
    setAddMsg(null);
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail.trim(), displayName: addDisplayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '추가 실패');
      setAddMsg({ ok: true, msg: '사용자가 추가되었습니다.' });
      setAddEmail('');
      setAddDisplayName('');
      await fetchData();
    } catch (e) {
      setAddMsg({ ok: false, msg: e instanceof Error ? e.message : '추가 실패' });
    } finally {
      setAddSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">권한 관리</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">신규 사용자 추가</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">이메일</label>
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">표시명</label>
            <input
              type="text"
              value={addDisplayName}
              onChange={(e) => setAddDisplayName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-40"
              placeholder="홍길동"
            />
          </div>
          <button
            onClick={handleAddUser}
            disabled={addSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {addSaving ? '추가 중...' : '추가'}
          </button>
        </div>
        {addMsg && (
          <p className={`mt-2 text-sm ${addMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{addMsg.msg}</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                {menus.map((m) => (
                  <th key={m.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                    {m.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.email} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{u.displayName}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </td>
                  {menus.map((m) => (
                    <td key={m.id} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={(localPerms[u.email] ?? []).includes(m.id)}
                        onChange={() => toggleMenu(u.email, m.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSave(u.email)}
                      disabled={saving === u.email}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      {saving === u.email ? '저장 중...' : '저장'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="p-6 text-center text-gray-500">등록된 사용자가 없습니다. 위에서 추가하세요.</p>
        )}
      </section>
    </div>
  );
}
