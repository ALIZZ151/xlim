(function () {
  const config = window.XLIM_CONFIG || {};
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '');

  function apiUrl(path) {
    if (!path.startsWith('/')) path = `/${path}`;
    return `${apiBaseUrl}${path}`;
  }

  function normalizePayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.data) return payload.data;
    return payload;
  }

  async function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    const opts = {
      credentials: 'include',
      ...options,
      headers
    };
    if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
      opts.headers = { ...headers, 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(apiUrl(path), opts);
    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { message: text }; }
    }
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Request gagal. Coba ulang bentar.';
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  function formatPrice(value) {
    const num = Number(String(value || '0').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(num) || num <= 0) return 'Hubungi admin';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
  }

  function priceNumber(value) {
    const num = Number(String(value || '0').replace(/[^0-9]/g, ''));
    return Number.isFinite(num) ? num : 0;
  }

  function safeText(value, fallback = '') {
    return String(value ?? fallback).replace(/[<>]/g, '').trim();
  }

  function imageUrl(src) {
    const fallback = config.fallbackImage || '/assets/img/product-fallback.svg';
    if (!src) return fallback;
    if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('/assets/')) return src;
    if (src.startsWith('/')) return `${apiBaseUrl}${src}`;
    return src;
  }

  function slugify(value) {
    return safeText(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk';
  }

  function productSlug(product) {
    return safeText(product.slug) || `${slugify(product.name || product.type || 'produk')}-${safeText(product.id || '')}`.replace(/-$/, '');
  }

  function getWhatsAppBase() {
    const number = String(config.whatsappNumber || '').replace(/[^0-9]/g, '');
    return number ? `https://wa.me/${number}` : '#';
  }

  function buildWhatsAppLink(product, note = '') {
    const lines = [
      'Halo admin XLIMSTORE, aku mau cek/order produk ini:',
      '',
      `Produk: ${safeText(product.name || product.type)}`,
      `Kategori: ${safeText(product.category)}`,
      `Harga: ${formatPrice(product.price)}`,
      `Status: ${safeText(product.status || 'ready')}`,
      product.id ? `ID Produk: ${safeText(product.id)}` : '',
      '',
      note ? `Catatan buyer: ${safeText(note)}` : 'Catatan buyer: -',
      '',
      'Tolong cek stok dan next step-nya ya.'
    ].filter(Boolean).join('\n');
    return `${getWhatsAppBase()}?text=${encodeURIComponent(lines)}`;
  }

  function toast(title, message = '') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const el = document.createElement('div');
    el.className = 'toast';
    const strong = document.createElement('strong');
    strong.textContent = title;
    el.appendChild(strong);
    if (message) {
      const span = document.createElement('span');
      span.textContent = message;
      el.appendChild(span);
    }
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function track(eventName, payload = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });
    if (typeof window.gtag === 'function') window.gtag('event', eventName, payload);
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function setSocialLinks() {
    document.querySelectorAll('[data-wa-link]').forEach((a) => {
      a.href = getWhatsAppBase();
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    document.querySelectorAll('[data-social]').forEach((a) => {
      const key = a.dataset.social;
      const url = config.social?.[key];
      if (url) a.href = url;
      a.rel = 'noopener noreferrer';
    });
  }

  window.Xlim = {
    config,
    apiUrl,
    apiFetch,
    normalizePayload,
    formatPrice,
    priceNumber,
    safeText,
    imageUrl,
    slugify,
    productSlug,
    buildWhatsAppLink,
    toast,
    track,
    createEl,
    setSocialLinks
  };
})();
