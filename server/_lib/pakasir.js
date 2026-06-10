'use strict';

const { config } = require('./config');
const { ApiError } = require('./responses');

const METHODS = new Set([
  'qris', 'bni_va', 'bri_va', 'cimb_niaga_va', 'permata_va', 'atm_bersama_va',
  'bnc_va', 'maybank_va', 'sampoerna_va', 'artha_graha_va',
]);

function requirePakasir() {
  if (!config.pakasirProject || !config.pakasirApiKey) {
    throw new ApiError('Pakasir belum dikonfigurasi. Isi PAKASIR_PROJECT/PAKASIR_SLUG dan PAKASIR_API_KEY di Vercel Env.', 500, 'PAKASIR_NOT_CONFIGURED');
  }
}

function normalizeMethod(method) {
  const value = String(method || config.pakasirDefaultMethod || 'qris').toLowerCase().trim();
  if (!METHODS.has(value)) throw new ApiError('Payment method Pakasir tidak valid.', 400, 'BAD_PAYMENT_METHOD');
  if (config.pakasirQrisOnly && value !== 'qris') return 'qris';
  return value;
}

function sanitizePakasirResponse(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = JSON.parse(JSON.stringify(value));
  if (clone.api_key) clone.api_key = '[redacted]';
  if (clone.apiKey) clone.apiKey = '[redacted]';
  return clone;
}

function buildPaymentUrl({ orderId, amount, redirect }) {
  requirePakasir();
  const url = new URL(`/pay/${encodeURIComponent(config.pakasirSlug || config.pakasirProject)}/${Number(amount || 0)}`, config.pakasirPaymentBaseUrl);
  url.searchParams.set('order_id', orderId);
  if (redirect) url.searchParams.set('redirect', redirect);
  if (config.pakasirQrisOnly) url.searchParams.set('qris_only', '1');
  return url.toString();
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.pakasirTimeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text }; }
    if (!res.ok) {
      throw new ApiError(`Pakasir request gagal (${res.status}).`, 502, 'PAKASIR_HTTP_ERROR');
    }
    return json;
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('Request ke Pakasir timeout.', 504, 'PAKASIR_TIMEOUT');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Gagal menghubungi Pakasir.', 502, 'PAKASIR_NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
}

async function createTransaction({ method, orderId, amount }) {
  requirePakasir();
  const paymentMethod = normalizeMethod(method);
  const url = new URL(`/api/transactioncreate/${paymentMethod}`, config.pakasirPaymentBaseUrl).toString();
  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: config.pakasirProject,
      order_id: orderId,
      amount: Number(amount),
      api_key: config.pakasirApiKey,
    }),
  });
  const payment = json.payment || json.data?.payment || json.data || json;
  if (!payment || !payment.order_id) throw new ApiError('Response Pakasir tidak berisi data payment.', 502, 'PAKASIR_BAD_RESPONSE');
  return { payment, raw: sanitizePakasirResponse(json) };
}

async function transactionDetail({ orderId, amount }) {
  requirePakasir();
  const url = new URL('/api/transactiondetail', config.pakasirPaymentBaseUrl);
  url.searchParams.set('project', config.pakasirProject);
  url.searchParams.set('amount', String(Number(amount)));
  url.searchParams.set('order_id', orderId);
  url.searchParams.set('api_key', config.pakasirApiKey);
  const json = await requestJson(url.toString(), { method: 'GET' });
  return { transaction: json.transaction || json.data?.transaction || json.data || json, raw: sanitizePakasirResponse(json) };
}

async function paymentSimulation({ orderId, amount }) {
  requirePakasir();
  const url = new URL('/api/paymentsimulation', config.pakasirPaymentBaseUrl).toString();
  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: config.pakasirProject, order_id: orderId, amount: Number(amount), api_key: config.pakasirApiKey }),
  });
  return sanitizePakasirResponse(json);
}

async function cancelTransaction({ orderId, amount }) {
  requirePakasir();
  const url = new URL('/api/transactioncancel', config.pakasirPaymentBaseUrl).toString();
  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: config.pakasirProject, order_id: orderId, amount: Number(amount), api_key: config.pakasirApiKey }),
  });
  return sanitizePakasirResponse(json);
}

module.exports = {
  METHODS,
  normalizeMethod,
  buildPaymentUrl,
  createTransaction,
  transactionDetail,
  paymentSimulation,
  cancelTransaction,
  sanitizePakasirResponse,
};
