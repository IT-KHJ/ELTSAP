import { createBrowserClient } from '@supabase/ssr';

export function createClientSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('createClientSupabaseClient must be called on the client side');
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getClientSupabase() {
  if (!clientInstance) {
    clientInstance = createClientSupabaseClient();
  }
  return clientInstance;
}
