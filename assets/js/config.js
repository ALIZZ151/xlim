export const BRAND_NAME = 'xlim store';
export const WA_NUMBER = '6283193075449';
export const TELEGRAM_USERNAME = 'xlimstor';

const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const runtimeConfig = typeof window !== 'undefined' && window.__XLIM_CONFIG__ ? window.__XLIM_CONFIG__ : {};

export const SUPABASE_URL = runtimeConfig.SUPABASE_URL || runtimeConfig.supabaseUrl || viteEnv.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = runtimeConfig.SUPABASE_ANON_KEY || runtimeConfig.supabaseAnonKey || viteEnv.VITE_SUPABASE_ANON_KEY || '';
export const SITE_URL = runtimeConfig.SITE_URL || viteEnv.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
export const ADMIN_TOKEN_KEY = 'xlim_admin_token_v1';
export const PENDING_ORDER_KEY = 'xlim_pending_order_v1';

export function waLink(message) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}
