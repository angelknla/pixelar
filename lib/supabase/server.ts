import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let cached: SupabaseClient<Database> | null = null;

const getServerKey = () => process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = (): boolean => {
  const key = getServerKey();

  try {
    const url = new URL(process.env.SUPABASE_URL ?? '');

    return (
      ['https:', 'http:'].includes(url.protocol) &&
      Boolean(key && key.length > 20 && !key.toLowerCase().startsWith('paste'))
    );
  } catch {
    return false;
  }
};

export const getSupabase = (): SupabaseClient<Database> | null => {
  if (!isSupabaseConfigured()) return null;

  if (!cached) {
    cached = createClient<Database>(process.env.SUPABASE_URL!, getServerKey()!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  return cached;
};
