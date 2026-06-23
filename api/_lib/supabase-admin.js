import { createClient } from '@supabase/supabase-js';

let cached = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.');
  }

  cached = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cached;
}
