import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

function createOfflineClient(reason) {
  console.warn(reason);

  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOAuth: async () => ({ error: { message: 'Supabase belum aktif. Isi environment variable Supabase di Vercel, lalu redeploy.' } })
  };

  return {
    auth,
    from(table) {
      const fail = async () => ({ data: null, error: { message: `Supabase belum aktif untuk table ${table}.` } });
      const builder = {
        select: () => builder,
        insert: () => ({ select: () => ({ single: fail }) }),
        update: () => ({ eq: fail }),
        delete: () => ({ eq: fail }),
        eq: () => builder,
        order: () => builder,
        single: fail,
        then(resolve) {
          return Promise.resolve({ data: null, error: { message: `Supabase belum aktif untuk table ${table}.` } }).then(resolve);
        }
      };
      return builder;
    }
  };
}

const createClient = window.supabase?.createClient;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY && createClient
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  : createOfflineClient('Supabase client tidak aktif. Pastikan /api/public-config jalan dan Vercel Env sudah diisi.');
