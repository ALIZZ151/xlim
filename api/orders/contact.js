'use strict';
const { withApi, ok, methodNotAllowed, ApiError } = require('../_lib/responses');
const { getSupabaseAdmin, mapDbError } = require('../_lib/supabase');
const { config } = require('../_lib/config');
const { readJsonBody, sanitizeText, clientHashes, buildOrderMessage, publicProduct, hmac } = require('../_lib/utils');
const { checkRateLimit, recordRateFailure, audit } = require('../_lib/auth');

module.exports = withApi(async (req, res) => {
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

  const supabase = getSupabaseAdmin();
  const query = supabase.from('products').select('*').eq('is_active', true);
  const { data, error } = await (isUuid(productId) ? query.eq('id', productId) : query.eq('slug', productId)).maybeSingle();
  if (error) throw mapDbError(error, 'Gagal membaca produk.');
  if (!data) throw new ApiError('Produk tidak ditemukan.', 404, 'NOT_FOUND');
  const product = publicProduct(data);
  const message = buildOrderMessage(product, customerNote);
  const whatsappUrl = config.whatsappNumber ? `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}` : '';
  const telegramUrl = `https://t.me/${config.telegramUsername}`;

  await supabase.from('contact_orders').insert({
    product_id: data.id,
    product_name: data.name,
    amount: Number(data.price || 0),
    contact_method: method,
    customer_note: customerNote || null,
    message,
    ip_hash: meta.ipHash,
    user_agent_hash: meta.userAgentHash,
  });
  await recordRateFailure(rateKey, 15, 60 * 1000);
  await audit('contact_order_clicked', req, { productId: data.id, method, amount: data.price });

  ok(res, {
    product,
    message,
    links: { whatsapp: whatsappUrl, telegram: telegramUrl },
    targetUrl: method === 'telegram' ? telegramUrl : whatsappUrl,
  }, 201);
});
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
