export const BRAND_NAME = 'xlim store';
export const WA_NUMBER = '6283193075449';
export const TELEGRAM_USERNAME = 'xlimstor';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
export const ADMIN_TOKEN_KEY = 'xlim_admin_token_v1';
export const PENDING_ORDER_KEY = 'xlim_pending_order_v1';

export function waLink(message) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}
