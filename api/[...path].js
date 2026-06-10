'use strict';

const fs = require('fs/promises');
const pathMod = require('path');
let formidablePkg = require('formidable');
const formidable = formidablePkg.formidable || formidablePkg;

const { withApi, ok, methodNotAllowed, ApiError } = require('../server/_lib/responses');
const { publicConfig, requiredEnvStatus, config } = require('../server/_lib/config');
const { getSupabaseAdmin, mapDbError } = require('../server/_lib/supabase');
const {
  readJsonBody, sanitizeText, clientHashes, buildOrderMessage, publicProduct,
  productFromBody, sha256, randomId,
} = require('../server/_lib/utils');
const {
  verifyPassword, createSession, setAdminCookie, clearAdminCookie, parseLoginBody,
  requireAdmin, audit, checkRateLimit, recordRateFailure, resetRateLimit, requestIntegrityHash,
} = require('../server/_lib/auth');
const {
  createTransaction, transactionDetail, paymentSimulation, cancelTransaction, buildPaymentUrl, normalizeMethod,
} = require('../server/_lib/pakasir');

const ALLOWED_UPLOADS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

module.exports = withApi(async (req, res) => {
  const route = getRoute(req);

  if (route === '/api/health') return health(req, res);
  if (route === '/api/config') return publicConfigRoute(req, res);

  if (route === '/api/products') return publicProducts(req, res);
  if (route.startsWith('/api/products/')) return publicProductById(req, res, routeParam(route, '/api/products/'));

  if (route === '/api/ratings') return ratings(req, res);
  if (route === '/api/orders/contact') return contactOrder(req, res);
  if (route === '/api/orders/create') return createOrder(req, res);
  if (route === '/api/payments/create') return createPaymentRoute(req, res);
  if (route === '/api/orders/status') return orderStatus(req, res);
  if (route === '/api/webhooks/pakasir') return pakasirWebhook(req, res);
  if (route === '/api/payments/simulate') return simulatePayment(req, res);
  if (route === '/api/payments/cancel') return cancelPayment(req, res);

  if (route === '/api/admin/login') return adminLogin(req, res);
  if (route === '/api/admin/logout') return adminLogout(req, res);
  if (route === '/api/admin/me') return adminMe(req, res);
  if (route === '/api/admin/audit') return adminAudit(req, res);
  if (route === '/api/admin/orders') return adminOrders(req, res);
  if (route.startsWith('/api/admin/orders/')) return adminOrderById(req, res, routeParam(route, '/api/admin/orders/'));
  if (route === '/api/admin/upload') return adminUpload(req, res);
  if (route === '/api/admin/products') return adminProducts(req, res);
  if (route.startsWith('/api/admin/products/')) return adminProductById(req, res, routeParam(route, '/api/admin/products/'));

  throw new ApiError('Endpoint tidak ditemukan.', 404, 'NOT_FOUND');
});

function getRoute(req) {
  const url = new URL(req.url || '/', 'https://xlimstore.local');
  return url.pathname.replace(/\/+$/, '') || '/';
}

function routeParam(route, prefix) {
  return decodeURIComponent(String(route.slice(prefix.length) || '').split('/')[0] || '').trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function findProduct(id, { activeOnly = false } = {}) {
  let query = getSupabaseAdmin().from('products').select('*');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await (isUuid(id) ? query.eq('id', id) : query.eq('slug', id)).maybeSingle();
  if (error) throw mapDbError(error, 'Gagal mengambil produk.');
  if (!data) throw new ApiError('Produk tidak ditemukan.', 404, 'NOT_FOUND');
  return data;
}

async function health(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  ok(res, {
    status: 'online',
    name: 'XLIMSTORE Vercel API',
    mode: 'single-serverless-router',
    timestamp: new Date().toISOString(),
    env: requiredEnvStatus(),
    config: publicConfig(),
  });
}

async function publicConfigRoute(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  ok(res, { config: publicConfig() });
}

async function publicProducts(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error, 'Gagal mengambil produk.');
  const products = (data || []).map(publicProduct);
  ok(res, { products, count: products.length, data: products });
}

async function publicProductById(req, res, id) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const row = await findProduct(id, { activeOnly: true });
  ok(res, { product: publicProduct(row), data: publicProduct(row) });
}

async function ratings(req, res) {
  if (req.method === 'GET') return getRatings(req, res);
  if (req.method === 'POST') return postRating(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
}

async function getRatings(req, res) {
  const { data, error } = await getSupabaseAdmin()
    .from('ratings')
    .select('id,name,rating,comment,avatar_url,created_at')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw mapDbError(error, 'Gagal mengambil rating.');
  const ratings = data || [];
  const count = ratings.length;
  const average = count ? Number((ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / count).toFixed(1)) : 0;
  ok(res, { ratings, average, count });
}

async function postRating(req, res) {
  const body = await readJsonBody(req);
  const meta = clientHashes(req);
  const key = `rating:${meta.fingerprint}`;
  await checkRateLimit(key, 2, 10 * 60 * 1000, 10 * 60 * 1000);
  const name = sanitizeText(body.name, 40) || 'Pembeli XLIM';
  const rating = Number(body.rating);
  const comment = sanitizeText(body.comment, 280);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError('Rating harus 1 sampai 5.', 400, 'VALIDATION_ERROR');
  if (comment.length < 3) throw new ApiError('Komentar minimal 3 karakter.', 400, 'VALIDATION_ERROR');
  const { data, error } = await getSupabaseAdmin().from('ratings').insert({
    name,
    rating,
    comment,
    avatar_url: null,
    ip_hash: meta.ipHash,
    user_agent_hash: meta.userAgentHash,
    is_visible: true,
  }).select('id,name,rating,comment,avatar_url,created_at').single();
  if (error) {
    await recordRateFailure(key, 2, 10 * 60 * 1000);
    throw mapDbError(error, 'Gagal menyimpan rating.');
  }
  await recordRateFailure(key, 2, 10 * 60 * 1000);
  await audit('rating_created', req, { id: data?.id, rating });
  ok(res, { rating: data, message: 'Rating masuk. Makasih sudah mampir!' }, 201);
}

async function contactOrder(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const meta = clientHashes(req);
  const rateKey = `order_contact:${meta.fingerprint}`;
  await checkRateLimit(rateKey, 15, 60 * 1000, 60 * 1000);

  const productId = sanitizeText(body.productId || body.id || body.slug, 120);
  const method = String(body.method || body.contactMethod || 'whatsapp').toLowerCase();
  const customerNote = sanitizeText(body.customerNote || body.note || '', 180);
  if (!['whatsapp', 'telegram'].includes(method)) throw new ApiError('Kontak tidak valid.', 400, 'VALIDATION_ERROR');
  if (!productId) throw new ApiError('Produk wajib dipilih.', 400, 'VALIDATION_ERROR');

  const row = await findProduct(productId, { activeOnly: true });
  const product = publicProduct(row);
  const message = buildOrderMessage(product, customerNote);
  const whatsappUrl = config.whatsappNumber ? `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}` : '';
  const telegramUrl = `https://t.me/${config.telegramUsername}`;

  await getSupabaseAdmin().from('contact_orders').insert({
    product_id: row.id,
    product_name: row.name,
    amount: Number(row.price || 0),
    contact_method: method,
    customer_note: customerNote || null,
    message,
    ip_hash: meta.ipHash,
    user_agent_hash: meta.userAgentHash,
  });
  await recordRateFailure(rateKey, 15, 60 * 1000);
  await audit('contact_order_clicked', req, { productId: row.id, method, amount: row.price });

  ok(res, {
    product,
    message,
    links: { whatsapp: whatsappUrl, telegram: telegramUrl },
    targetUrl: method === 'telegram' ? telegramUrl : whatsappUrl,
  }, 201);
}


async function createOrder(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const meta = clientHashes(req);
  const rateKey = `order_create:${meta.fingerprint}`;
  await checkRateLimit(rateKey, 8, 5 * 60 * 1000, 5 * 60 * 1000);

  const productId = sanitizeText(body.productId || body.product_id || body.id || body.slug, 120);
  const customerName = sanitizeText(body.customerName || body.customer_name || body.name, 70);
  const customerContact = sanitizeText(body.customerContact || body.customer_contact || body.contact || '', 90);
  const customerNote = sanitizeText(body.customerNote || body.customer_note || body.note || '', 280);
  const requestedMethod = normalizeMethod(body.paymentMethod || body.payment_method || config.pakasirDefaultMethod);

  if (!productId) throw new ApiError('Produk wajib dipilih.', 400, 'VALIDATION_ERROR');
  if (customerName.length < 2) throw new ApiError('Nama pembeli minimal 2 karakter.', 400, 'VALIDATION_ERROR');

  const row = await findProduct(productId, { activeOnly: true });
  if (row.status === 'soldout' || row.status === 'inactive') throw new ApiError('Produk ini belum bisa dibeli otomatis.', 409, 'PRODUCT_UNAVAILABLE');
  const amount = Number(row.price || 0);
  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError('Harga produk belum valid untuk checkout otomatis.', 400, 'BAD_PRODUCT_PRICE');

  const supabase = getSupabaseAdmin();
  let orderId = makeOrderId();
  let inserted = null;
  let insertError = null;
  for (let i = 0; i < 4; i += 1) {
    orderId = i === 0 ? orderId : makeOrderId();
    const result = await supabase.from('orders').insert({
      order_id: orderId,
      product_id: row.id,
      product_name: row.name,
      customer_name: customerName,
      customer_contact: customerContact || null,
      customer_note: customerNote || null,
      amount,
      status: 'pending',
      source: 'website',
    }).select('*').single();
    if (!result.error) { inserted = result.data; insertError = null; break; }
    insertError = result.error;
    if (result.error.code !== '23505') break;
  }
  if (!inserted) throw mapDbError(insertError, 'Gagal membuat order.');

  await recordRateFailure(rateKey, 8, 5 * 60 * 1000);
  await audit('order_created', req, { orderId: inserted.order_id, productId: row.id, amount });

  const payment = await createPaymentForOrder(inserted, requestedMethod, req);
  ok(res, {
    order: publicOrder(inserted, payment),
    payment: publicPayment(payment),
    message: 'Invoice berhasil dibuat. Lanjutkan pembayaran sebelum expired.',
  }, 201);
}

async function createPaymentRoute(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const orderId = sanitizeText(body.orderId || body.order_id, 80).toUpperCase();
  const method = normalizeMethod(body.paymentMethod || body.payment_method || config.pakasirDefaultMethod);
  if (!isOrderId(orderId)) throw new ApiError('Order ID tidak valid.', 400, 'BAD_ORDER_ID');
  const { order, payment } = await getOrderWithPayment(orderId);
  if (!order) throw new ApiError('Order tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  if (order.status !== 'pending') throw new ApiError('Order ini sudah tidak pending.', 409, 'ORDER_NOT_PENDING');
  if (payment?.status === 'pending' && payment.payment_number) {
    return ok(res, { order: publicOrder(order, payment), payment: publicPayment(payment), reused: true });
  }
  const newPayment = await createPaymentForOrder(order, method, req);
  ok(res, { order: publicOrder(order, newPayment), payment: publicPayment(newPayment) }, 201);
}

async function createPaymentForOrder(order, method, req) {
  const supabase = getSupabaseAdmin();
  const paymentUrl = buildPaymentUrl({ orderId: order.order_id, amount: order.amount, redirect: redirectFor(order.order_id) });
  let providerPayment = {
    project: config.pakasirProject,
    order_id: order.order_id,
    amount: Number(order.amount),
    fee: 0,
    total_payment: Number(order.amount),
    payment_method: method,
    payment_number: '',
    expired_at: null,
  };
  let raw = { flow: config.pakasirFlow, payment_url: paymentUrl };

  if (config.pakasirFlow === 'api') {
    const created = await createTransaction({ method, orderId: order.order_id, amount: order.amount });
    providerPayment = { ...providerPayment, ...(created.payment || {}) };
    raw = { ...created.raw, payment_url: paymentUrl };
  }

  const payload = {
    order_id: order.order_id,
    provider: 'pakasir',
    provider_project: config.pakasirProject,
    payment_method: providerPayment.payment_method || method,
    amount: Number(providerPayment.amount || order.amount),
    fee: Number(providerPayment.fee || 0),
    total_payment: Number(providerPayment.total_payment || providerPayment.amount || order.amount),
    payment_number: providerPayment.payment_number || '',
    payment_url: paymentUrl,
    status: 'pending',
    expired_at: providerPayment.expired_at || null,
    raw_response: raw,
  };

  const { data, error } = await supabase.from('payments').upsert(payload, { onConflict: 'order_id,provider' }).select('*').single();
  if (error) throw mapDbError(error, 'Gagal menyimpan data payment.');
  if (data.expired_at && !order.expired_at) {
    await supabase.from('orders').update({ expired_at: data.expired_at }).eq('order_id', order.order_id);
  }
  await audit('payment_created', req, { orderId: order.order_id, method: data.payment_method, amount: data.amount, totalPayment: data.total_payment });
  return data;
}

async function orderStatus(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const meta = clientHashes(req);
  const rateKey = `order_status:${meta.fingerprint}`;
  await checkRateLimit(rateKey, 60, 60 * 1000, 60 * 1000);
  const orderId = queryParam(req, 'order_id').toUpperCase();
  if (!isOrderId(orderId)) throw new ApiError('Order ID tidak valid.', 400, 'BAD_ORDER_ID');
  const { order, payment } = await getOrderWithPayment(orderId);
  if (!order) throw new ApiError('Order tidak ditemukan.', 404, 'ORDER_NOT_FOUND');

  if (order.status === 'pending' && payment?.expired_at && new Date(payment.expired_at) < new Date()) {
    await getSupabaseAdmin().from('orders').update({ status: 'expired', expired_at: payment.expired_at }).eq('order_id', order.order_id).eq('status', 'pending');
    await getSupabaseAdmin().from('payments').update({ status: 'expired' }).eq('order_id', order.order_id).eq('status', 'pending');
    order.status = 'expired';
    payment.status = 'expired';
  }
  await recordRateFailure(rateKey, 60, 60 * 1000);
  ok(res, { order: publicOrder(order, payment), payment: payment ? publicPayment(payment) : null });
}

async function getOrderWithPayment(orderId) {
  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase.from('orders').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw mapDbError(error, 'Gagal mengambil order.');
  if (!order) return { order: null, payment: null };
  const { data: payment, error: payError } = await supabase.from('payments').select('*').eq('order_id', orderId).maybeSingle();
  if (payError) throw mapDbError(payError, 'Gagal mengambil payment.');
  return { order, payment };
}

async function pakasirWebhook(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const payload = await readJsonBody(req, 256 * 1024);
  const supabase = getSupabaseAdmin();
  const orderId = sanitizeText(payload.order_id || payload.orderId, 90).toUpperCase();
  const amount = Number(payload.amount || 0);
  const project = sanitizeText(payload.project, 120);
  const status = sanitizeText(payload.status, 60).toLowerCase();
  const paymentMethod = sanitizeText(payload.payment_method || payload.paymentMethod, 60).toLowerCase();
  const completedAt = payload.completed_at || payload.completedAt || null;

  const { data: log } = await supabase.from('payment_webhook_logs').insert({
    provider: 'pakasir',
    order_id: orderId || null,
    amount: Number.isFinite(amount) ? amount : null,
    project: project || null,
    status: status || null,
    payment_method: paymentMethod || null,
    completed_at: completedAt || null,
    is_valid: false,
    validation_message: 'received',
    raw_payload: payload || {},
  }).select('*').single();
  await audit('webhook_received', req, { provider: 'pakasir', orderId, amount, project, status });

  async function invalid(message, code = 'WEBHOOK_INVALID') {
    if (log?.id) await supabase.from('payment_webhook_logs').update({ validation_message: message, is_valid: false }).eq('id', log.id);
    await audit('webhook_invalid', req, { orderId, message });
    throw new ApiError(message, 400, code);
  }

  if (!config.pakasirWebhookEnabled) return ok(res, { ignored: true, message: 'Webhook Pakasir sedang dinonaktifkan.' });
  if (!isOrderId(orderId)) return invalid('Order ID webhook tidak valid.');
  if (project !== config.pakasirProject) return invalid('Project Pakasir tidak cocok.');
  if (!Number.isInteger(amount) || amount <= 0) return invalid('Amount webhook tidak valid.');
  if (status !== 'completed') return invalid('Status webhook bukan completed.');

  const { order, payment } = await getOrderWithPayment(orderId);
  if (!order) return invalid('Order tidak ditemukan di database.', 'ORDER_NOT_FOUND');
  if (Number(order.amount) !== amount) return invalid('Amount webhook tidak cocok dengan order.');

  if (order.status === 'paid') {
    if (log?.id) await supabase.from('payment_webhook_logs').update({ is_valid: true, validation_message: 'already_paid' }).eq('id', log.id);
    return ok(res, { processed: false, alreadyPaid: true });
  }

  const detail = await transactionDetail({ orderId, amount });
  const transaction = detail.transaction || {};
  const txStatus = sanitizeText(transaction.status, 60).toLowerCase();
  const txOrderId = sanitizeText(transaction.order_id || transaction.orderId, 90).toUpperCase();
  const txAmount = Number(transaction.amount || 0);
  const txProject = sanitizeText(transaction.project, 120);
  if (txStatus !== 'completed' || txOrderId !== orderId || txAmount !== amount || txProject !== config.pakasirProject) {
    return invalid('Transaction Detail API tidak memvalidasi webhook.', 'WEBHOOK_DETAIL_MISMATCH');
  }

  let completedIso = new Date().toISOString();
  if (completedAt) {
    const parsedCompleted = new Date(completedAt);
    if (!Number.isNaN(parsedCompleted.getTime())) completedIso = parsedCompleted.toISOString();
  }
  await supabase.from('orders').update({ status: 'paid', paid_at: completedIso }).eq('order_id', orderId).in('status', ['pending', 'failed']);
  await supabase.from('payments').update({
    status: 'completed',
    completed_at: completedIso,
    payment_method: paymentMethod || payment?.payment_method || transaction.payment_method || null,
    raw_response: { webhook: payload, detail: detail.raw },
  }).eq('order_id', orderId);
  if (log?.id) await supabase.from('payment_webhook_logs').update({ is_valid: true, validation_message: 'completed' }).eq('id', log.id);
  await audit('payment_completed', req, { orderId, amount, method: paymentMethod || transaction.payment_method });
  ok(res, { processed: true, orderId, status: 'paid' });
}

async function simulatePayment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (config.isProd && !config.pakasirSandboxEnabled) {
    throw new ApiError('Payment simulation hanya aktif di non-production atau saat PAKASIR_SANDBOX_ENABLED=true.', 403, 'SIMULATION_DISABLED');
  }
  const body = await readJsonBody(req);
  const orderId = sanitizeText(body.orderId || body.order_id, 90).toUpperCase();
  if (!isOrderId(orderId)) throw new ApiError('Order ID tidak valid.', 400, 'BAD_ORDER_ID');
  const { order } = await getOrderWithPayment(orderId);
  if (!order) throw new ApiError('Order tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  const data = await paymentSimulation({ orderId, amount: order.amount });
  await audit('payment_simulated', req, { orderId, amount: order.amount });
  ok(res, { data, message: 'Simulasi payment dikirim ke Pakasir sandbox.' });
}

async function cancelPayment(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = await readJsonBody(req);
  const orderId = sanitizeText(body.orderId || body.order_id, 90).toUpperCase();
  if (!isOrderId(orderId)) throw new ApiError('Order ID tidak valid.', 400, 'BAD_ORDER_ID');
  const { order } = await getOrderWithPayment(orderId);
  if (!order) throw new ApiError('Order tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
  if (order.status !== 'pending') throw new ApiError('Order sudah tidak pending.', 409, 'ORDER_NOT_PENDING');
  const data = await cancelTransaction({ orderId, amount: order.amount });
  await getSupabaseAdmin().from('orders').update({ status: 'cancelled' }).eq('order_id', orderId).eq('status', 'pending');
  await getSupabaseAdmin().from('payments').update({ status: 'cancelled', raw_response: { cancel: data } }).eq('order_id', orderId);
  await audit('payment_cancelled', req, { orderId, amount: order.amount });
  ok(res, { data, orderId, status: 'cancelled', message: 'Order dibatalkan.' });
}

async function adminOrders(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  await requireAdmin(req, { requireNonce: false });
  const status = queryParam(req, 'status').toLowerCase();
  let query = getSupabaseAdmin().from('orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (['pending', 'paid', 'expired', 'cancelled', 'failed'].includes(status)) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw mapDbError(error, 'Gagal mengambil order admin.');
  const orderIds = (data || []).map((x) => x.order_id);
  let payments = [];
  if (orderIds.length) {
    const payRes = await getSupabaseAdmin().from('payments').select('*').in('order_id', orderIds);
    if (!payRes.error) payments = payRes.data || [];
  }
  const payMap = new Map(payments.map((p) => [p.order_id, p]));
  ok(res, { orders: (data || []).map((o) => publicOrder(o, payMap.get(o.order_id))), count: (data || []).length });
}

async function adminOrderById(req, res, orderIdRaw) {
  const orderId = sanitizeText(orderIdRaw, 90).toUpperCase();
  if (!isOrderId(orderId)) throw new ApiError('Order ID tidak valid.', 400, 'BAD_ORDER_ID');
  if (req.method === 'GET') {
    await requireAdmin(req, { requireNonce: false });
    const { order, payment } = await getOrderWithPayment(orderId);
    if (!order) throw new ApiError('Order tidak ditemukan.', 404, 'ORDER_NOT_FOUND');
    return ok(res, { order: publicOrder(order, payment), payment: payment ? publicPayment(payment) : null });
  }
  if (req.method === 'PATCH') {
    await requireAdmin(req);
    const body = await readJsonBody(req);
    const status = sanitizeText(body.status, 40).toLowerCase();
    if (!['pending', 'paid', 'expired', 'cancelled', 'failed'].includes(status)) throw new ApiError('Status order tidak valid.', 400, 'BAD_STATUS');
    const patch = { status };
    if (status === 'paid') patch.paid_at = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin().from('orders').update(patch).eq('order_id', orderId).select('*').single();
    if (error) throw mapDbError(error, 'Gagal update order.');
    if (status === 'paid') await getSupabaseAdmin().from('payments').update({ status: 'completed', completed_at: patch.paid_at }).eq('order_id', orderId);
    await audit('order_updated', req, { orderId, status });
    const { payment } = await getOrderWithPayment(orderId);
    return ok(res, { order: publicOrder(data, payment), message: 'Order berhasil diupdate.' });
  }
  return methodNotAllowed(res, ['GET', 'PATCH']);
}

async function adminLogin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const env = requiredEnvStatus();
  if (!env.adminKey || !env.adminPasswordHash || !env.adminPasswordSalt || !env.adminSessionSecret || !env.adminApiHashSecret) {
    throw new ApiError('Admin belum dikonfigurasi. Isi ADMIN_KEY, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD_SALT, ADMIN_SESSION_SECRET, dan ADMIN_API_HASH_SECRET.', 500, 'ADMIN_NOT_CONFIGURED');
  }
  const body = await parseLoginBody(req);
  const meta = clientHashes(req);
  const rateKey = `admin_login:${meta.fingerprint}:${body.adminKey ? meta.userAgentOnly : 'blank'}`;
  await checkRateLimit(rateKey, 3, 4 * 60 * 1000, 4 * 60 * 1000);
  const keyOk = body.adminKey && body.adminKey === config.adminKey;
  const passwordOk = verifyPassword(body.password);
  if (!keyOk || !passwordOk) {
    await recordRateFailure(rateKey, 3, 4 * 60 * 1000);
    await audit('admin_login_failed', req, { keyProvided: Boolean(body.adminKey) });
    throw new ApiError('Login gagal. Cek key dan password.', 401, 'LOGIN_FAILED');
  }
  await resetRateLimit(rateKey);
  const session = createSession(req);
  setAdminCookie(res, session.token, session.maxAge);
  await audit('admin_login_success', req, { sidHash: meta.userAgentOnly });
  ok(res, {
    authenticated: true,
    csrfToken: session.payload.csrf,
    sessionExpiresAt: new Date(session.payload.exp).toISOString(),
  });
}

async function adminLogout(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { await requireAdmin(req, { requireNonce: false }); } catch (_) {}
  clearAdminCookie(res);
  await audit('admin_logout', req, {});
  ok(res, { authenticated: false, message: 'Logout berhasil.' });
}

async function adminMe(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireAdmin(req, { requireNonce: false });
    ok(res, {
      authenticated: true,
      csrfToken: session.csrf,
      sessionExpiresAt: new Date(session.exp).toISOString(),
      env: requiredEnvStatus(),
      config: publicConfig(),
    });
  } catch (_) {
    ok(res, { authenticated: false, env: requiredEnvStatus(), config: publicConfig() });
  }
}

async function adminAudit(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  await requireAdmin(req, { requireNonce: false });
  const { data, error } = await getSupabaseAdmin()
    .from('admin_audit_logs')
    .select('id,action,detail,created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw mapDbError(error, 'Gagal mengambil audit log.');
  ok(res, { logs: data || [] });
}

async function adminProducts(req, res) {
  if (req.method === 'GET') return listAdminProducts(req, res);
  if (req.method === 'POST') return createAdminProduct(req, res);
  return methodNotAllowed(res, ['GET', 'POST']);
}

async function listAdminProducts(req, res) {
  await requireAdmin(req, { requireNonce: false });
  const { data, error } = await getSupabaseAdmin()
    .from('products')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw mapDbError(error, 'Gagal mengambil produk admin.');
  const products = (data || []).map(publicProduct);
  ok(res, { products, count: products.length });
}

async function createAdminProduct(req, res) {
  await requireAdmin(req);
  const body = await readJsonBody(req);
  const payload = productFromBody(body);
  const signature = requestIntegrityHash(req, sha256(JSON.stringify(payload)));
  const { data, error } = await getSupabaseAdmin().from('products').insert(payload).select('*').single();
  if (error) throw mapDbError(error, 'Gagal menambah produk.');
  await audit('product_created', req, { id: data.id, slug: data.slug, signature });
  ok(res, { product: publicProduct(data), message: 'Produk berhasil ditambahkan.' }, 201);
}

async function adminProductById(req, res, id) {
  if (req.method === 'GET') return getAdminProduct(req, res, id);
  if (req.method === 'PATCH' || req.method === 'PUT') return updateAdminProduct(req, res, id);
  if (req.method === 'DELETE') return deleteAdminProduct(req, res, id);
  return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}

async function getAdminProduct(req, res, id) {
  await requireAdmin(req, { requireNonce: false });
  const row = await findProduct(id);
  ok(res, { product: publicProduct(row) });
}

async function updateAdminProduct(req, res, id) {
  await requireAdmin(req);
  const current = await findProduct(id);
  const body = await readJsonBody(req);
  const payload = productFromBody(body, current);
  const signature = requestIntegrityHash(req, sha256(JSON.stringify(payload)));
  const { data, error } = await getSupabaseAdmin().from('products').update(payload).eq('id', current.id).select('*').single();
  if (error) throw mapDbError(error, 'Gagal mengedit produk.');
  await audit('product_updated', req, { id: data.id, slug: data.slug, signature });
  ok(res, { product: publicProduct(data), message: 'Produk berhasil diupdate.' });
}

async function deleteAdminProduct(req, res, id) {
  await requireAdmin(req);
  const current = await findProduct(id);
  const signature = requestIntegrityHash(req, sha256(current.id));
  const { data, error } = await getSupabaseAdmin().from('products').update({ is_active: false, status: 'inactive' }).eq('id', current.id).select('*').single();
  if (error) throw mapDbError(error, 'Gagal menghapus produk.');
  await audit('product_deleted', req, { id: current.id, slug: current.slug, softDelete: true, signature });
  ok(res, { product: publicProduct(data), message: 'Produk dihapus dari katalog publik.' });
}

async function adminUpload(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  await requireAdmin(req);
  const { files } = await parseForm(req);
  const file = Array.isArray(files.image) ? files.image[0] : files.image || (Array.isArray(files.file) ? files.file[0] : files.file);
  if (!file) throw new ApiError('File gambar wajib diupload.', 400, 'NO_FILE');
  const mime = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_UPLOADS.has(mime)) throw new ApiError('Format gambar harus JPG, PNG, atau WebP.', 400, 'BAD_FILE_TYPE');
  if (Number(file.size || 0) > config.maxUploadBytes) throw new ApiError('Ukuran gambar terlalu besar.', 413, 'FILE_TOO_LARGE');
  const buffer = await fs.readFile(file.filepath);
  if (!validMagic(buffer, mime)) throw new ApiError('Isi file tidak cocok dengan format gambar.', 400, 'BAD_FILE_MAGIC');
  const ext = ALLOWED_UPLOADS.get(mime);
  const safeName = sanitizeText(pathMod.parse(file.originalFilename || 'produk').name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk';
  const objectName = `products/${Date.now()}-${randomId(8)}-${safeName}.${ext}`;
  const { error } = await getSupabaseAdmin().storage.from(config.supabaseStorageBucket).upload(objectName, buffer, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new ApiError(error.message || 'Upload ke Supabase Storage gagal.', 500, 'UPLOAD_FAILED');
  const { data } = getSupabaseAdmin().storage.from(config.supabaseStorageBucket).getPublicUrl(objectName);
  const publicUrl = data?.publicUrl || '';
  await audit('product_image_uploaded', req, {
    objectName,
    mime,
    size: file.size,
    signature: requestIntegrityHash(req, sha256(objectName)),
  });
  ok(res, { url: publicUrl, path: objectName, message: 'Gambar berhasil diupload.' }, 201);
}

function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: config.maxUploadBytes,
    allowEmptyFiles: false,
    filter(part) {
      return ['image', 'file'].includes(part.name || '') && ALLOWED_UPLOADS.has(String(part.mimetype || '').toLowerCase());
    },
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(new ApiError(err.message || 'Upload gagal diproses.', err.httpCode || 400, 'UPLOAD_PARSE_ERROR'));
      resolve({ fields, files });
    });
  });
}

function validMagic(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}
