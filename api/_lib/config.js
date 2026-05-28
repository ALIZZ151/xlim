'use strict';

function bool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value).toLowerCase());
}

function int(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function allowedOrigins() {
  const set = new Set();
  const add = (value) => {
    String(value || '').split(',').forEach((item) => {
      const clean = trimSlash(item.trim());
      if (clean) set.add(clean);
    });
  };
  add(process.env.FRONTEND_ORIGIN);
  add(process.env.NEXT_PUBLIC_SITE_URL);
  add('http://localhost:3000');
  add('http://localhost:5173');
  add('http://127.0.0.1:3000');
  return set;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  siteUrl: trimSlash(process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_ORIGIN || 'https://xlim.alizz.my.id'),
  frontendOrigin: trimSlash(process.env.FRONTEND_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://xlim.alizz.my.id'),
  allowedOrigins: allowedOrigins(),

  supabaseUrl: trimSlash(process.env.SUPABASE_URL || ''),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'product-images',

  adminKey: process.env.ADMIN_KEY || '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  adminPasswordSalt: process.env.ADMIN_PASSWORD_SALT || '',
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || '',
  adminApiHashSecret: process.env.ADMIN_API_HASH_SECRET || '',
  adminSessionTtlHours: int('ADMIN_SESSION_TTL_HOURS', 12),

  whatsappNumber: digits(process.env.WHATSAPP_NUMBER || '6283193075449'),
  telegramUsername: String(process.env.TELEGRAM_USERNAME || 'xlimstor').replace(/^@/, ''),
  maxUploadBytes: Math.min(int('MAX_UPLOAD_BYTES', 3 * 1024 * 1024), 10 * 1024 * 1024),
};

function publicConfig() {
  return {
    siteUrl: config.siteUrl,
    whatsappNumber: config.whatsappNumber,
    telegramUsername: config.telegramUsername,
    contacts: {
      whatsapp: config.whatsappNumber ? `https://wa.me/${config.whatsappNumber}` : '',
      telegram: `https://t.me/${config.telegramUsername}`,
    },
    features: {
      googleLogin: false,
      supabase: Boolean(config.supabaseUrl),
      manualOrder: true,
    },
  };
}

function requiredEnvStatus() {
  return {
    supabaseUrl: Boolean(config.supabaseUrl),
    supabaseServiceRoleKey: Boolean(config.supabaseServiceRoleKey),
    storageBucket: config.supabaseStorageBucket,
    adminKey: Boolean(config.adminKey),
    adminPasswordHash: Boolean(config.adminPasswordHash),
    adminPasswordSalt: Boolean(config.adminPasswordSalt),
    adminSessionSecret: Boolean(config.adminSessionSecret),
    adminApiHashSecret: Boolean(config.adminApiHashSecret),
    whatsappNumber: Boolean(config.whatsappNumber),
    telegramUsername: Boolean(config.telegramUsername),
  };
}

module.exports = { config, publicConfig, requiredEnvStatus, bool, int, trimSlash, digits };
