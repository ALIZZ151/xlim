import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.warn('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel.');
}

export const supabaseAdmin = createClient(url || 'https://example.supabase.co', serviceRole || 'missing-service-role', {
  auth: { persistSession: false, autoRefreshToken: false }
});
