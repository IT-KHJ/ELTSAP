import { redirect } from 'next/navigation';
import { getUser as getServerUser, getSession } from './server';

export { getServerUser as getUser, getSession };

export async function requireAuth() {
  const user = await getServerUser();
  if (!user) redirect('/internal/login');
  return user;
}
