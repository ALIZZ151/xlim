import { getSupabaseAdmin } from './_lib/supabase-admin.js';
import { readJson, requireAdmin, sendJson } from './_lib/admin-auth.js';

const HIDDEN_MARK = '[XLIM_HIDDEN_HISTORY]';
const SUSPENDED_ROLE = 'suspended';
const DEACTIVATED_ROLE = 'deactivated';

function getCustomerName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Customer XLIM';
}

function getCustomerAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(getCustomerName(user))}`;
}

function lower(value = '') {
  return String(value).toLowerCase().trim();
}

function isHiddenOrder(order) {
  return String(order?.admin_note || '').startsWith(HIDDEN_MARK);
}

function orderValue(order, keys, fallback = '') {
  for (const key of keys) {
    const value = order?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function normalizeOrder(order) {
  return {
    id: order.id,
    user_id: order.user_id,
    product_name: orderValue(order, ['product_name', 'name', 'title'], 'Order XLIM'),
    price: orderValue(order, ['price', 'amount', 'total_price'], 'Chat Admin'),
    status: orderValue(order, ['status', 'order_status'], 'pending'),
    payment_status: orderValue(order, ['payment_status', 'payment', 'paid_status'], 'unpaid'),
    admin_note: orderValue(order, ['admin_note', 'note', 'notes'], ''),
    hidden_by_admin: isHiddenOrder(order),
    created_at: orderValue(order, ['created_at', 'inserted_at', 'date'], null)
  };
}

async function listAllCustomers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

function filterCustomers(users, query) {
  const q = lower(query);
  if (!q) return users;
  return users.filter((user) => lower(getCustomerName(user)).includes(q) || lower(user.email || '').includes(q) || lower(user.id || '').includes(q));
}

async function getProfilesById(supabase, userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await supabase.from('profiles').select('id,email,full_name,avatar_url,role').in('id', userIds);
  if (error) return new Map();
  return new Map((data || []).map((profile) => [profile.id, profile]));
}

async function sendCustomerHistory(req, res, supabase) {
  const query = req.query?.q || req.query?.email || '';
  const customers = filterCustomers(await listAllCustomers(supabase), query);
  const customerIds = customers.map((user) => user.id);
  const profiles = await getProfilesById(supabase, customerIds);
  let orders = [];

  if (customerIds.length > 0) {
    const { data, error } = await supabase.from('orders').select('*').in('user_id', customerIds).order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    orders = data || [];
  }

  const ordersByUser = new Map();
  for (const order of orders) {
    if (!ordersByUser.has(order.user_id)) ordersByUser.set(order.user_id, []);
    ordersByUser.get(order.user_id).push(normalizeOrder(order));
  }

  const users = customers.map((user) => {
    const profile = profiles.get(user.id) || {};
    const userOrders = ordersByUser.get(user.id) || [];
    const visibleOrders = userOrders.filter((order) => !order.hidden_by_admin);
    const suspended = profile.role === SUSPENDED_ROLE || user.app_metadata?.xlim_suspended === true;
    const deactivated = profile.role === DEACTIVATED_ROLE || user.app_metadata?.xlim_deactivated === true;
    return {
      id: user.id,
      name: profile.full_name || getCustomerName(user),
      email: profile.email || user.email || '',
      avatar_url: profile.avatar_url || getCustomerAvatar(user),
      provider: user.app_metadata?.provider || 'google',
      suspended,
      deactivated,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      order_count: visibleOrders.length,
      hidden_order_count: userOrders.length - visibleOrders.length,
      orders: userOrders
    };
  });

  users.sort((a, b) => {
    if (b.order_count !== a.order_count) return b.order_count - a.order_count;
    return new Date(b.last_sign_in_at || b.created_at || 0) - new Date(a.last_sign_in_at || a.created_at || 0);
  });

  sendJson(res, 200, { success: true, users, total_users: users.length, total_orders: orders.length });
}

async function updateOrderVisibility(res, supabase, body) {
  const orderId = String(body.order_id || body.id || '').trim();
  const userId = String(body.user_id || '').trim();
  const mode = String(body.mode || 'hide').trim();
  if (!orderId && !userId) {
    sendJson(res, 400, { success: false, message: 'order_id atau user_id wajib diisi.' });
    return;
  }

  const payload = mode === 'restore'
    ? { status: 'pending', admin_note: 'Riwayat dikembalikan admin.' }
    : { status: 'cancelled', admin_note: `${HIDDEN_MARK} Riwayat disembunyikan admin karena order tidak jadi.` };

  let query = supabase.from('orders').update(payload);
  if (orderId) query = query.eq('id', orderId);
  if (!orderId && userId) query = query.eq('user_id', userId).not('admin_note', 'like', `${HIDDEN_MARK}%`);
  const { error } = await query;
  if (error) throw error;
  sendJson(res, 200, { success: true, message: mode === 'restore' ? 'Riwayat berhasil dikembalikan.' : 'Riwayat berhasil disembunyikan dari akun user.' });
}

async function setCustomerState(res, supabase, body) {
  const userId = String(body.user_id || '').trim();
  const action = String(body.action || '').trim();
  if (!userId) {
    sendJson(res, 400, { success: false, message: 'user_id wajib diisi.' });
    return;
  }

  const { data: authUser, error: readError } = await supabase.auth.admin.getUserById(userId);
  if (readError) throw readError;
  const user = authUser?.user;
  const meta = user?.app_metadata || {};
  const suspended = action === 'suspend_user';
  const deactivated = action === 'deactivate_user';
  const role = deactivated ? DEACTIVATED_ROLE : suspended ? SUSPENDED_ROLE : 'customer';

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...meta, xlim_suspended: suspended, xlim_deactivated: deactivated }
  });
  if (authError) throw authError;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    email: user?.email || null,
    full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || null,
    avatar_url: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
    role
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const message = deactivated ? 'Akun berhasil dinonaktifkan dari website.' : suspended ? 'Akun berhasil disuspend.' : 'Akun berhasil diaktifkan kembali.';
  sendJson(res, 200, { success: true, message });
}

async function handlePatch(req, res, supabase) {
  const body = await readJson(req);
  const action = String(body.action || '').trim();
  if (['suspend_user', 'unsuspend_user', 'deactivate_user', 'activate_user'].includes(action)) {
    await setCustomerState(res, supabase, body);
    return;
  }
  await updateOrderVisibility(res, supabase, body);
}

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  try {
    if (!requireAdmin(req, res)) return;

    if (req.method === 'GET') {
      if (req.query?.mode === 'customers') {
        await sendCustomerHistory(req, res, supabase);
        return;
      }
      const { data, error } = await supabase.from('orders').select('*').not('admin_note', 'like', `${HIDDEN_MARK}%`).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      sendJson(res, 200, { success: true, orders: data || [] });
      return;
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      const id = String(body.id || '').trim();
      if (!id) {
        sendJson(res, 400, { success: false, message: 'ID order kosong.' });
        return;
      }
      const payload = {};
      if (body.status !== undefined) payload.status = String(body.status);
      if (body.payment_status !== undefined) payload.payment_status = String(body.payment_status);
      if (body.admin_note !== undefined) payload.admin_note = String(body.admin_note);
      const { data, error } = await supabase.from('orders').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      sendJson(res, 200, { success: true, order: data });
      return;
    }

    if (req.method === 'PATCH') {
      await handlePatch(req, res, supabase);
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method tidak didukung.' });
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || 'Server error.' });
  }
}
