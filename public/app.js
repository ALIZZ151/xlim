(() => {
  'use strict';

  const CFG = window.XLIMSTORE_CONFIG || {};
  const API_BASE = trimSlash(CFG.API_BASE_URL || '');
  const SITE_URL = trimSlash(CFG.SITE_URL || location.origin);
  const ROUTES = new Set(['/demo', '/produk', '/rating', '/admin', '/invoice', '/payment/success']);
  const state = {
    route: normalizeRoute(location.pathname),
    products: [],
    productsLoadedAt: 0,
    ratings: null,
    config: {
      whatsappNumber: digits(CFG.WHATSAPP_NUMBER || ''),
      telegramUsername: String(CFG.TELEGRAM_USERNAME || 'xlimstor').replace(/^@/, ''),
      features: { manualOrder: true, automaticPayment: true },
    },
    csrfToken: sessionStorage.getItem('xlim_admin_csrf') || '',
    adminAuthed: false,
    editingProduct: null,
    invoicePoll: null,
  };

  const app = document.getElementById('app');
  const toast = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const contactFloat = document.getElementById('contactFloat');
  const floatWa = document.getElementById('floatWa');
  const floatTg = document.getElementById('floatTg');
  const splash = document.getElementById('splashScreen');
  const splashVideo = document.getElementById('splashVideo');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-link]');
    if (link && link.getAttribute('href')?.startsWith('/')) {
      event.preventDefault();
      navigate(link.getAttribute('href'));
      return;
    }
    if (event.target.closest('[data-close-modal]')) closeModal();
  });
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  window.addEventListener('popstate', () => routeTo(normalizeRoute(location.pathname), true));

  init();

  async function init() {
    initSplash();
    await loadPublicConfig();
    await routeTo(state.route, true);
    hideSplashSoon();
  }

  function initSplash() {
    if (!splash) return;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion && splashVideo) {
      splashVideo.removeAttribute('autoplay');
      splashVideo.pause?.();
    } else if (splashVideo) {
      const play = splashVideo.play?.();
      if (play && typeof play.catch === 'function') play.catch(() => hideSplashSoon(650));
    }
    window.setTimeout(() => hideSplashSoon(), 2600);
  }

  function hideSplashSoon(delay = 900) {
    if (!splash || splash.classList.contains('is-hidden')) return;
    window.setTimeout(() => {
      splash.classList.add('is-hidden');
      window.setTimeout(() => splash.remove(), 520);
    }, delay);
  }

  function normalizeRoute(pathname) {
    const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
    if (clean === '/') return '/demo';
    return ROUTES.has(clean) ? clean : '/demo';
  }

  function navigate(path) {
    const url = new URL(path, location.origin);
    const route = normalizeRoute(url.pathname);
    history.pushState({}, '', route + url.search);
    routeTo(route);
  }

  async function routeTo(route, fromHistory = false) {
    clearInvoicePoll();
    state.route = route;
    updateNav();
    updateContactFloat();
    app.setAttribute('aria-busy', 'true');
    try {
      if (route === '/demo') renderDemo();
      if (route === '/produk') await renderProducts();
      if (route === '/rating') await renderRating();
      if (route === '/admin') await renderAdmin();
      if (route === '/invoice' || route === '/payment/success') await renderInvoicePage();
      if (!fromHistory) app.focus({ preventScroll: true });
    } catch (error) {
      showError(error.message || 'Halaman gagal dimuat.');
    } finally {
      app.setAttribute('aria-busy', 'false');
    }
  }

  function updateNav() {
    document.querySelectorAll('[data-route]').forEach((item) => item.classList.toggle('active', item.dataset.route === state.route));
    document.querySelectorAll('.desktop-nav a').forEach((item) => item.classList.toggle('active', item.getAttribute('href') === state.route));
  }

  async function loadPublicConfig() {
    try {
      const res = await api('/api/config', { silent: true });
      state.config = { ...state.config, ...(res.config || {}) };
    } catch (_) {}
  }

  function updateContactFloat() {
    const shouldShow = ['/demo', '/produk'].includes(state.route);
    contactFloat?.classList.toggle('hidden', !shouldShow);
    if (floatWa) floatWa.onclick = () => openContact('whatsapp');
    if (floatTg) floatTg.onclick = () => openContact('telegram');
  }

  function renderDemo() {
    setMeta('XLIMSTORE — Produk Digital Otomatis', 'XLIMSTORE: katalog produk digital dengan checkout otomatis Pakasir, QRIS, dan admin support resmi.');
    app.replaceChildren();
    const hero = el('section', { class: 'hero' });
    const card = el('div', { class: 'hero-card' });
    card.append(
      el('div', { class: 'eyebrow', text: 'XLIMSTORE PREMIUM' }),
      el('h1', { text: 'Produk digital, checkout otomatis.' }),
      el('p', { text: 'Pilih produk, isi data singkat, bayar via QRIS/VA Pakasir, lalu sistem cek status otomatis. Kalau butuh bantuan, admin tetap siap lewat WhatsApp atau Telegram.' }),
      div('hero-actions', buttonLink('/produk', 'Beli Sekarang', 'btn primary'), buttonLink('/rating', 'Lihat Rating', 'btn ghost'), externalButton('Tanya Admin', whatsappUrl('Halo admin XLIMSTORE, saya mau tanya produk.'), 'btn soft'))
    );
    const phone = el('div', { class: 'phone-preview' });
    const screen = el('div', { class: 'screen glass' });
    screen.append(
      div('mini-header', el('span', { class: 'mini-chip', text: 'Auto invoice' }), el('span', { class: 'mini-chip', text: 'QRIS ready' })),
      miniProduct('/assets/img/product-akun-ff-15k.webp', 'Akun FF Google', 'Rp 15.000'),
      miniProduct('/assets/img/product-sewa-bot-whatsapp.webp', 'Sewa Bot WhatsApp', 'Mulai Rp 5.000'),
      miniProduct('/assets/img/product-nokos-whatsapp.webp', 'Nokos WhatsApp', 'Rp 5.000'),
      el('div', { class: 'invoice-mini', text: 'Status: pending → paid otomatis via webhook' })
    );
    phone.append(screen);
    hero.append(card, phone);

    const steps = sectionPanel('Cara Order Otomatis', 'Flow dibuat lebih rapi untuk buyer: user tidak perlu menunggu admin hanya untuk membuat invoice.');
    const grid = el('div', { class: 'steps' });
    [
      ['1', 'Pilih produk', 'Cari item di katalog dan cek status stok.'],
      ['2', 'Isi checkout', 'Masukkan nama, kontak opsional, dan catatan.'],
      ['3', 'Bayar Pakasir', 'Gunakan QRIS atau VA sesuai konfigurasi project.'],
      ['4', 'Status otomatis', 'Webhook + status polling mengubah invoice menjadi paid.'],
    ].forEach(([n, title, text]) => grid.append(step(n, title, text)));
    steps.append(grid);

    const info = el('section', { class: 'section panel split-panel' });
    info.append(
      div('', el('div', { class: 'eyebrow', text: 'SUPPORT TETAP ADA' }), el('h2', { text: 'Payment otomatis, admin tetap bisa bantu.' }), el('p', { text: 'WhatsApp dan Telegram sekarang jadi jalur bantuan, bukan payment utama. Setelah pembayaran sukses, user bisa lanjut hubungi admin untuk proses produk digital.' })),
      div('row-actions', buttonLink('/produk', 'Buka Katalog', 'btn primary'), externalButton('WhatsApp', whatsappUrl('Halo admin XLIMSTORE, saya butuh bantuan order.'), 'btn ghost'), externalButton('Telegram', telegramUrl(), 'btn cyan'))
    );
    app.append(hero, steps, info);
  }

  async function renderProducts() {
    setMeta('Katalog Produk XLIMSTORE', 'Katalog produk digital XLIMSTORE dengan checkout otomatis Pakasir.');
    app.replaceChildren();
    const panel = sectionPanel('Katalog Produk', 'Cari produk digital yang kamu butuh. Klik Beli Sekarang untuk membuat invoice otomatis.');
    const toolbar = el('div', { class: 'toolbar' });
    const search = inputField('Cari produk', 'q', 'search', 'Akun FF, bot WhatsApp, nokos...');
    const category = selectField('Kategori', 'category');
    const sort = selectField('Urutkan', 'sort');
    category.input.append(option('Semua', 'Semua kategori'));
    sort.input.append(option('popular', 'Default'), option('cheap', 'Termurah'), option('expensive', 'Termahal'), option('name', 'Nama A-Z'));
    toolbar.append(search.wrap, category.wrap, sort.wrap);
    const grid = el('div', { class: 'grid' });
    grid.append(skeleton(), skeleton(), skeleton());
    panel.append(toolbar, grid);
    app.append(panel);
    await loadProducts();
    const categories = [...new Set(state.products.map((p) => p.category || 'Produk Digital'))].sort((a, b) => a.localeCompare(b, 'id'));
    categories.forEach((item) => category.input.append(option(item, item)));
    const update = () => renderProductGrid(grid, search.input.value, category.input.value, sort.input.value);
    search.input.addEventListener('input', update);
    category.input.addEventListener('change', update);
    sort.input.addEventListener('change', update);
    update();
  }

  async function renderRating() {
    setMeta('Rating XLIMSTORE', 'Rating dan testimoni pembeli XLIMSTORE.');
    app.replaceChildren();
    await loadRatings();
    const panel = sectionPanel('Rating Pembeli', 'Bantu buyer lain dengan review singkat setelah transaksi.');
    const form = el('form', { class: 'rating-form' });
    const name = inputField('Nama', 'name', 'text', 'Nama kamu');
    const rating = selectField('Rating', 'rating');
    [5,4,3,2,1].forEach((n) => rating.input.append(option(String(n), `${n} bintang`)));
    const comment = textareaField('Komentar', 'comment', 'Tulis pengalaman singkat...');
    const submit = el('button', { class: 'btn primary', type: 'submit', text: 'Kirim rating' });
    form.append(name.wrap, rating.wrap, comment.wrap, div('row-actions', submit));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await api('/api/ratings', { method: 'POST', body: { name: name.input.value, rating: Number(rating.input.value), comment: comment.input.value } });
        state.ratings = null;
        notify('Rating masuk. Makasih!');
        await renderRating();
      } catch (error) { notify(error.message); }
      finally { submit.disabled = false; }
    });
    panel.append(form);

    const summary = el('section', { class: 'section panel' });
    const data = state.ratings || { ratings: [], average: 0, count: 0 };
    const big = el('div', { class: 'rating-big' });
    big.append(el('strong', { text: String(data.average || '0') }), el('span', { text: `${data.count || 0} review` }));
    const list = el('div', { class: 'rating-list' });
    (data.ratings || []).slice(0, 12).forEach((item) => list.append(reviewCard(item)));
    if (!list.childNodes.length) list.append(el('div', { class: 'empty-state', text: 'Belum ada rating. Jadilah yang pertama.' }));
    summary.append(el('div', { class: 'eyebrow', text: 'TESTIMONI' }), el('h2', { text: 'Apa kata pembeli?' }), div('rating-summary', big, list));
    app.append(panel, summary);
  }

  function renderProductGrid(grid, query = '', category = 'Semua', sort = 'popular') {
    const q = query.trim().toLowerCase();
    let products = state.products.filter((p) => {
      const hay = [p.name, p.category, p.description, ...(p.features || [])].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (category === 'Semua' || p.category === category);
    });
    if (sort === 'cheap') products.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'expensive') products.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') products.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    grid.replaceChildren();
    if (!products.length) return grid.append(el('div', { class: 'empty-state wide', text: 'Produk nggak ketemu. Coba keyword lain atau chat admin.' }));
    products.forEach((product) => grid.append(productCard(product)));
  }

  function productCard(product) {
    const card = el('article', { class: 'product-card panel' });
    const media = el('div', { class: 'product-media' });
    media.append(el('img', { src: imageSrc(product), alt: product.name, loading: 'lazy', width: 420, height: 315 }));
    media.append(el('span', { class: `status-badge ${product.status || 'ready'}`, text: statusText(product.status) }));
    const body = el('div', { class: 'product-body' });
    const notes = el('ul', { class: 'notes' });
    (product.features || []).slice(0, 4).forEach((item) => notes.append(el('li', { text: item })));
    body.append(
      el('div', { class: 'eyebrow', text: product.category || 'Produk Digital' }),
      el('h3', { text: product.name }),
      el('p', { text: product.description || 'Detail produk bisa ditanyakan ke admin resmi.' }),
      el('div', { class: 'price', text: product.priceLabel || formatRupiah(product.price) }),
      notes,
      div('row-actions', button('Beli Sekarang', 'btn primary', () => openCheckoutModal(product)), button('Detail', 'btn ghost', () => openProductModal(product)))
    );
    card.append(media, body);
    return card;
  }

  function openProductModal(product) {
    const card = modalCard(`Detail ${product.name}`);
    const summary = el('div', { class: 'order-summary' });
    summary.append(el('img', { src: imageSrc(product), alt: product.name, loading: 'lazy' }));
    const info = el('div');
    const notes = el('ul', { class: 'notes' });
    (product.features || []).forEach((item) => notes.append(el('li', { text: item })));
    info.append(
      el('div', { class: 'eyebrow', text: product.category || 'Produk Digital' }),
      el('h2', { text: product.name }),
      el('p', { text: product.description || 'Detail lengkap bisa langsung ditanyakan ke admin resmi.' }),
      el('div', { class: 'price', text: product.priceLabel || formatRupiah(product.price) }),
      notes,
      div('row-actions', button('Beli Sekarang', 'btn primary', () => openCheckoutModal(product)), button('Tanya Admin', 'btn ghost', () => openContact('whatsapp')))
    );
    summary.append(info);
    card.append(summary);
    openModal(card);
  }

  function openCheckoutModal(product) {
    if (product.status === 'soldout' || product.status === 'inactive') return notify('Produk ini belum bisa dibeli otomatis. Tanya admin dulu ya.');
    const card = modalCard('Checkout Otomatis');
    const layout = el('div', { class: 'checkout-layout' });
    const side = el('div', { class: 'checkout-product' });
    side.append(el('img', { src: imageSrc(product), alt: product.name }), el('h3', { text: product.name }), el('p', { text: product.category || 'Produk Digital' }), el('div', { class: 'price', text: product.priceLabel || formatRupiah(product.price) }));
    const form = el('form', { class: 'checkout-form' });
    const name = inputField('Nama pembeli', 'customerName', 'text', 'Contoh: Alizz');
    const contact = inputField('Kontak WhatsApp/Telegram (opsional)', 'customerContact', 'text', '08xx / @username');
    const note = textareaField('Catatan (opsional)', 'customerNote', 'Catatan akun, request, atau info tambahan...');
    const method = selectField('Metode pembayaran', 'paymentMethod');
    method.input.append(option('qris', 'QRIS'), option('bni_va', 'BNI VA'), option('bri_va', 'BRI VA'), option('permata_va', 'Permata VA'), option('cimb_niaga_va', 'CIMB Niaga VA'), option('atm_bersama_va', 'ATM Bersama VA'));
    const submit = el('button', { class: 'btn primary full', type: 'submit', text: 'Buat Invoice' });
    const help = externalButton('Tanya Admin', whatsappUrl(`Halo admin XLIMSTORE, saya mau tanya produk ${product.name}.`), 'btn ghost full');
    form.append(name.wrap, contact.wrap, note.wrap, method.wrap, div('checkout-note', el('b', { text: 'Aman:' }), el('span', { text: 'Harga diambil dari database, bukan dari frontend. API key Pakasir tetap di backend.' })), submit, help);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Membuat invoice...';
      try {
        const res = await api('/api/orders/create', {
          method: 'POST',
          body: {
            productId: product.id || product.slug,
            customerName: name.input.value,
            customerContact: contact.input.value,
            customerNote: note.input.value,
            paymentMethod: method.input.value,
          },
        });
        notify('Invoice berhasil dibuat.');
        showPaymentModal(res.order, res.payment);
      } catch (error) { notify(error.message || 'Checkout gagal.'); }
      finally { submit.disabled = false; submit.textContent = 'Buat Invoice'; }
    });
    layout.append(side, form);
    card.append(layout);
    openModal(card);
  }

  function showPaymentModal(order, payment) {
    const card = modalCard('Invoice Pembayaran');
    card.append(paymentPanel(order, payment, { modalMode: true }));
    openModal(card);
  }

  async function renderInvoicePage() {
    const orderId = new URLSearchParams(location.search).get('order_id') || '';
    setMeta('Invoice XLIMSTORE', 'Cek status invoice XLIMSTORE.');
    app.replaceChildren();
    const panel = sectionPanel('Invoice Pembayaran', orderId ? 'Cek detail dan status pembayaran kamu di sini.' : 'Masukkan invoice ID untuk cek status order.');
    if (!orderId) {
      const form = el('form', { class: 'invoice-search' });
      const input = inputField('Order ID', 'order_id', 'text', 'XLIM-YYYYMMDD-XXXXXX');
      const btn = el('button', { class: 'btn primary', type: 'submit', text: 'Cek Invoice' });
      form.append(input.wrap, btn);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!input.input.value.trim()) return notify('Masukkan Order ID dulu.');
        navigate(`/invoice?order_id=${encodeURIComponent(input.input.value.trim().toUpperCase())}`);
      });
      panel.append(form);
      return app.append(panel);
    }
    const holder = el('div', { class: 'invoice-holder' });
    holder.append(skeleton());
    panel.append(holder);
    app.append(panel);
    await refreshInvoice(holder, orderId, true);
  }

  async function refreshInvoice(holder, orderId, startPolling = false) {
    try {
      const res = await api(`/api/orders/status?order_id=${encodeURIComponent(orderId)}`);
      holder.replaceChildren(paymentPanel(res.order, res.payment, { modalMode: false }));
      if (startPolling && res.order?.status === 'pending') {
        clearInvoicePoll();
        state.invoicePoll = window.setInterval(() => refreshInvoice(holder, orderId, false), 12000);
      }
      if (res.order?.status !== 'pending') clearInvoicePoll();
    } catch (error) {
      holder.replaceChildren(el('div', { class: 'empty-state', text: error.message || 'Invoice tidak ditemukan.' }));
    }
  }

  function paymentPanel(order, payment, options = {}) {
    const wrap = el('div', { class: 'payment-panel' });
    const top = el('div', { class: 'invoice-head' });
    top.append(
      div('', el('div', { class: 'eyebrow', text: 'INVOICE' }), el('h2', { text: order.orderId || '-' }), el('p', { text: order.productName || 'Produk digital' })),
      el('span', { class: `pay-status ${order.status || 'pending'}`, text: statusOrderText(order.status) })
    );
    const rows = el('div', { class: 'invoice-rows' });
    rows.append(
      invoiceRow('Nama pembeli', order.customerName || '-'),
      invoiceRow('Harga produk', formatRupiah(order.amount)),
      invoiceRow('Biaya admin', formatRupiah(payment?.fee || 0)),
      invoiceRow('Total bayar', formatRupiah(payment?.totalPayment || order.amount), true),
      invoiceRow('Metode', methodLabel(payment?.paymentMethod || '-')),
      invoiceRow('Expired', formatDateTime(payment?.expiredAt || order.expiredAt) || '-')
    );
    const payBox = el('div', { class: 'pay-box' });
    if ((payment?.paymentMethod || '').includes('qris') && payment?.paymentNumber) {
      const qr = el('div', { class: 'qris-box' });
      const qrTarget = el('div', { class: 'qrcode', id: `qr-${order.orderId}` });
      qr.append(qrTarget, el('p', { text: 'Scan QRIS ini dari aplikasi e-wallet/mobile banking. Pastikan total pembayaran sama.' }));
      payBox.append(qr);
      window.setTimeout(() => renderQr(qrTarget, payment.paymentNumber), 50);
    } else if (payment?.paymentNumber) {
      payBox.append(el('label', { text: 'Nomor pembayaran / VA' }), div('payment-number', el('code', { text: payment.paymentNumber }), button('Copy', 'btn small ghost', () => copyText(payment.paymentNumber))));
    } else {
      payBox.append(el('div', { class: 'empty-state', text: 'Payment number belum tersedia. Pakai tombol buka halaman Pakasir atau buat ulang payment.' }));
    }
    const actions = div('row-actions',
      button('Cek Status', 'btn primary', async () => {
        const res = await api(`/api/orders/status?order_id=${encodeURIComponent(order.orderId)}`);
        notify(statusOrderText(res.order?.status || 'pending'));
        if (options.modalMode) showPaymentModal(res.order, res.payment);
        else await routeTo(state.route, true);
      }),
      payment?.paymentUrl ? externalButton('Buka Pakasir', payment.paymentUrl, 'btn cyan') : null,
      button('Copy Invoice ID', 'btn ghost', () => copyText(order.orderId)),
      order.status === 'paid' ? externalButton('Hubungi Admin', whatsappUrl(`Halo admin XLIMSTORE, pembayaran saya berhasil. Invoice: ${order.orderId}`), 'btn soft') : null
    );
    wrap.append(top, rows, payBox, actions);
    if (order.status === 'paid') wrap.append(el('div', { class: 'success-box', text: 'Pembayaran berhasil. Simpan invoice ini dan hubungi admin untuk proses produk digital.' }));
    return wrap;
  }

  function renderQr(target, text) {
    target.replaceChildren();
    if (window.QRCode) {
      try {
        new window.QRCode(target, { text, width: 224, height: 224, correctLevel: window.QRCode.CorrectLevel?.M || 0 });
        return;
      } catch (_) {}
    }
    target.append(el('pre', { class: 'qr-fallback', text }));
  }

  async function renderAdmin() {
    setMeta('Admin XLIMSTORE', 'Dashboard admin XLIMSTORE.');
    updateContactFloat();
    app.replaceChildren(sectionPanel('Cek sesi admin...', 'Sebentar.'));
    const me = await adminMe();
    state.adminAuthed = Boolean(me.authenticated);
    if (!state.adminAuthed) return renderAdminLogin(me);
    state.csrfToken = me.csrfToken || state.csrfToken;
    sessionStorage.setItem('xlim_admin_csrf', state.csrfToken);
    await renderAdminDashboard(me);
  }

  function renderAdminLogin(me = {}) {
    const wrap = el('section', { class: 'section panel admin-login' });
    wrap.append(el('div', { class: 'eyebrow', text: 'ADMIN HIDDEN' }), el('h2', { text: 'Login dashboard XLIMSTORE' }), el('p', { text: 'Masuk pakai Admin Key + Password. Secret disimpan di Vercel ENV, bukan di browser.' }));
    const form = el('form', { class: 'admin-box' });
    const key = inputField('Admin Key', 'adminKey', 'password', 'Masukkan admin key');
    const pass = inputField('Password', 'password', 'password', 'Masukkan password');
    const submit = el('button', { type: 'submit', class: 'btn primary', text: 'Login admin' });
    const env = me.env || {};
    const status = el('div', { class: 'status-grid' });
    [
      ['Supabase', env.supabaseUrl && env.supabaseServiceRoleKey ? 'Ready' : 'Belum env'],
      ['Admin Hash', env.adminPasswordHash && env.adminPasswordSalt ? 'Ready' : 'Belum env'],
      ['Pakasir', env.pakasirProject && env.pakasirApiKey ? 'Ready' : 'Belum env'],
    ].forEach(([a,b]) => status.append(statusCard(a,b)));
    form.append(key.wrap, pass.wrap, div('row-actions', submit), status);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const res = await api('/api/admin/login', { method: 'POST', body: { adminKey: key.input.value, password: pass.input.value } });
        state.csrfToken = res.csrfToken || '';
        sessionStorage.setItem('xlim_admin_csrf', state.csrfToken);
        notify('Login berhasil. Dashboard dibuka.');
        await renderAdmin();
      } catch (error) { notify(error.message); }
      finally { submit.disabled = false; }
    });
    wrap.append(form);
    app.replaceChildren(wrap);
  }

  async function renderAdminDashboard(me) {
    app.replaceChildren();
    const wrap = el('section', { class: 'admin-wrap' });
    const head = el('div', { class: 'section panel' });
    head.append(
      el('div', { class: 'eyebrow', text: 'DASHBOARD ADMIN' }),
      el('h2', { text: 'Kelola XLIMSTORE' }),
      el('p', { text: 'Tambah produk, upload gambar, pantau order Pakasir, dan cek konfigurasi.' }),
      div('row-actions', button('Reload data', 'btn ghost', () => renderAdmin()), button('Logout', 'btn danger', adminLogout))
    );
    const env = me.env || {};
    const status = el('div', { class: 'status-grid' });
    [
      ['Supabase DB', env.supabaseUrl && env.supabaseServiceRoleKey ? 'Ready' : 'Belum lengkap'],
      ['Storage bucket', env.storageBucket || 'product-images'],
      ['Pakasir', env.pakasirProject && env.pakasirApiKey ? `${env.pakasirFlow || 'api'} · ${env.pakasirDefaultMethod || 'qris'}` : 'Belum env'],
      ['Webhook', env.pakasirWebhookEnabled ? 'Aktif' : 'Nonaktif'],
      ['Admin security', env.adminApiHashSecret ? 'Session + CSRF + nonce' : 'Cek ENV'],
      ['WhatsApp', me.config?.whatsappNumber || 'Belum set'],
    ].forEach(([a,b]) => status.append(statusCard(a,b)));
    head.append(status);

    const grid = el('div', { class: 'admin-grid' });
    const formBox = el('div', { class: 'admin-box' });
    formBox.append(el('h3', { text: 'Form produk' }), productForm());
    const listBox = el('div', { class: 'admin-box' });
    listBox.append(el('h3', { text: 'Daftar produk' }), el('div', { class: 'empty-state', text: 'Memuat produk admin...' }));
    grid.append(formBox, listBox);

    const ordersBox = el('div', { class: 'admin-box' });
    ordersBox.append(el('h3', { text: 'Order terbaru' }), el('div', { class: 'empty-state', text: 'Memuat order...' }));
    const auditBox = el('div', { class: 'admin-box' });
    auditBox.append(el('h3', { text: 'Audit log' }), el('div', { class: 'empty-state', text: 'Memuat audit...' }));
    wrap.append(head, grid, ordersBox, auditBox);
    app.append(wrap);
    await refreshAdminProducts(listBox);
    await refreshAdminOrders(ordersBox);
    await refreshAdminAudit(auditBox);
  }

  function productForm(product = null) {
    state.editingProduct = product;
    const form = el('form', { id: 'productForm' });
    const name = inputField('Nama produk', 'name', 'text', 'Akun FF Sultan');
    const category = inputField('Kategori', 'category', 'text', 'Akun FF');
    const price = inputField('Harga angka', 'price', 'number', '15000');
    const priceLabel = inputField('Harga display', 'price_label', 'text', 'Rp 15.000');
    const status = selectField('Status', 'status');
    [['ready','Ready'], ['soldout','Sold out'], ['preorder','Preorder'], ['inactive','Nonaktif']].forEach(([v,l]) => status.input.append(option(v,l)));
    const sortOrder = inputField('Sort order', 'sort_order', 'number', '0');
    const desc = textareaField('Deskripsi', 'description', 'Tulis deskripsi singkat produk...');
    const features = textareaField('Fitur / notes', 'features', 'Satu fitur per baris');
    const imageUrl = inputField('Image URL', 'image_url', 'url', 'Upload gambar atau paste URL');
    const upload = inputField('Upload gambar', 'image', 'file', '');
    upload.input.accept = 'image/jpeg,image/png,image/webp';
    const preview = el('img', { class: 'preview-img hidden', alt: 'Preview gambar produk' });
    const uploadBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Upload ke Supabase' });
    const submit = el('button', { type: 'submit', class: 'btn primary', text: product ? 'Simpan edit' : 'Tambah produk' });
    const reset = el('button', { type: 'button', class: 'btn ghost', text: 'Reset form' });
    if (product) {
      name.input.value = product.name || '';
      category.input.value = product.category || '';
      price.input.value = product.price || 0;
      priceLabel.input.value = product.priceLabel || '';
      status.input.value = product.status || 'ready';
      sortOrder.input.value = product.sortOrder || 0;
      desc.input.value = product.description || '';
      features.input.value = (product.features || []).join('\n');
      imageUrl.input.value = product.imageUrl || product.image || '';
      if (imageUrl.input.value) { preview.src = imageUrl.input.value; preview.classList.remove('hidden'); }
    }
    imageUrl.input.addEventListener('input', () => {
      if (imageUrl.input.value) { preview.src = imageUrl.input.value; preview.classList.remove('hidden'); }
      else preview.classList.add('hidden');
    });
    upload.input.addEventListener('change', () => {
      const file = upload.input.files?.[0];
      if (!file) return;
      preview.src = URL.createObjectURL(file);
      preview.classList.remove('hidden');
    });
    uploadBtn.addEventListener('click', async () => {
      const file = upload.input.files?.[0];
      if (!file) return notify('Pilih file gambar dulu.');
      uploadBtn.disabled = true;
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await adminFetch('/api/admin/upload', { method: 'POST', formData: fd });
        imageUrl.input.value = res.url;
        preview.src = res.url;
        preview.classList.remove('hidden');
        notify('Gambar berhasil diupload.');
      } catch (error) { notify(error.message); }
      finally { uploadBtn.disabled = false; }
    });
    reset.addEventListener('click', () => renderAdmin());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      const payload = {
        name: name.input.value,
        category: category.input.value,
        price: Number(price.input.value),
        price_label: priceLabel.input.value,
        status: status.input.value,
        sort_order: Number(sortOrder.input.value || 0),
        description: desc.input.value,
        features: features.input.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
        image_url: imageUrl.input.value,
      };
      try {
        const url = product ? `/api/admin/products/${encodeURIComponent(product.id)}` : '/api/admin/products';
        await adminFetch(url, { method: product ? 'PATCH' : 'POST', body: payload });
        notify(product ? 'Produk berhasil diupdate.' : 'Produk berhasil ditambahkan.');
        await loadProducts(true);
        await renderAdmin();
      } catch (error) { notify(error.message); }
      finally { submit.disabled = false; }
    });
    form.append(name.wrap, category.wrap, price.wrap, priceLabel.wrap, status.wrap, sortOrder.wrap, desc.wrap, features.wrap, imageUrl.wrap, upload.wrap, preview, div('row-actions', uploadBtn, submit, reset));
    return form;
  }

  async function refreshAdminProducts(container) {
    try {
      const res = await adminFetch('/api/admin/products');
      const products = res.products || [];
      const table = tableWrap(['Gambar', 'Produk', 'Harga', 'Status', 'Aksi']);
      products.forEach((p) => {
        const tr = el('tr');
        tr.append(
          el('td', {}, el('img', { class: 'thumb', src: imageSrc(p), alt: p.name, loading: 'lazy' })),
          el('td', {}, el('strong', { text: p.name }), el('p', { text: `${p.category || '-'} · ${p.slug || p.id}` })),
          el('td', { text: p.priceLabel || formatRupiah(p.price) }),
          el('td', { text: `${statusText(p.status)}${p.isActive ? '' : ' · nonaktif'}` }),
          el('td', {}, div('row-actions', button('Edit', 'btn small ghost', () => replaceProductForm(p)), button('Hapus', 'btn small danger', () => deleteProduct(p))))
        );
        table.tbody.append(tr);
      });
      container.replaceChildren(el('h3', { text: 'Daftar produk' }), products.length ? table.wrap : el('div', { class: 'empty-state', text: 'Belum ada produk. Tambah dari form kiri.' }));
    } catch (error) {
      container.replaceChildren(el('h3', { text: 'Daftar produk' }), el('div', { class: 'empty-state', text: error.message }));
    }
  }

  async function refreshAdminOrders(container) {
    try {
      const res = await adminFetch('/api/admin/orders');
      const orders = res.orders || [];
      const table = tableWrap(['Invoice', 'Produk', 'Pembeli', 'Total', 'Status', 'Aksi']);
      orders.forEach((o) => {
        const tr = el('tr');
        tr.append(
          el('td', {}, el('strong', { text: o.orderId }), el('p', { text: formatDateTime(o.createdAt) })),
          el('td', { text: o.productName || '-' }),
          el('td', {}, el('strong', { text: o.customerName || '-' }), el('p', { text: o.customerContact || '-' })),
          el('td', { text: formatRupiah(o.payment?.totalPayment || o.amount) }),
          el('td', {}, el('span', { class: `pay-status mini ${o.status}`, text: statusOrderText(o.status) })),
          el('td', {}, div('row-actions', button('Detail', 'btn small ghost', () => openAdminOrder(o)), o.status === 'pending' ? button('Set paid', 'btn small primary', () => setAdminOrderStatus(o.orderId, 'paid')) : null))
        );
        table.tbody.append(tr);
      });
      container.replaceChildren(el('h3', { text: 'Order terbaru' }), orders.length ? table.wrap : el('div', { class: 'empty-state', text: 'Belum ada order otomatis.' }));
    } catch (error) {
      container.replaceChildren(el('h3', { text: 'Order terbaru' }), el('div', { class: 'empty-state', text: error.message }));
    }
  }

  async function refreshAdminAudit(container) {
    try {
      const res = await adminFetch('/api/admin/audit');
      const logs = res.logs || [];
      const list = el('div', { class: 'audit-list' });
      logs.slice(0, 20).forEach((log) => list.append(el('div', { class: 'audit-item' }, el('b', { text: log.action }), el('span', { text: formatDateTime(log.created_at) }))));
      container.replaceChildren(el('h3', { text: 'Audit log' }), logs.length ? list : el('div', { class: 'empty-state', text: 'Audit masih kosong.' }));
    } catch (error) {
      container.replaceChildren(el('h3', { text: 'Audit log' }), el('div', { class: 'empty-state', text: error.message }));
    }
  }

  function replaceProductForm(product) {
    const holder = document.querySelector('#productForm')?.parentElement;
    if (!holder) return;
    holder.replaceChildren(el('h3', { text: 'Edit produk' }), productForm(product));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(product) {
    if (!confirm(`Hapus ${product.name} dari katalog publik?`)) return;
    try {
      await adminFetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      notify('Produk dihapus dari katalog publik.');
      await loadProducts(true);
      await renderAdmin();
    } catch (error) { notify(error.message); }
  }

  async function openAdminOrder(order) {
    try {
      const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(order.orderId)}`);
      const card = modalCard(`Order ${order.orderId}`);
      card.append(paymentPanel(res.order, res.payment, { modalMode: true }));
      openModal(card);
    } catch (error) { notify(error.message); }
  }

  async function setAdminOrderStatus(orderId, status) {
    if (!confirm(`Update ${orderId} menjadi ${status}?`)) return;
    try {
      await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body: { status } });
      notify('Status order diupdate.');
      await renderAdmin();
    } catch (error) { notify(error.message); }
  }

  async function adminLogout() {
    try { await adminFetch('/api/admin/logout', { method: 'POST', skipNonce: true }); } catch (_) {}
    sessionStorage.removeItem('xlim_admin_csrf');
    state.csrfToken = '';
    notify('Logout berhasil.');
    await renderAdmin();
  }

  async function adminMe() { return api('/api/admin/me', { silent: true }); }

  async function loadProducts(force = false) {
    const ttl = 60 * 1000;
    if (!force && state.products.length && Date.now() - state.productsLoadedAt < ttl) return;
    const res = await api('/api/products');
    state.products = Array.isArray(res.products) ? res.products : [];
    state.productsLoadedAt = Date.now();
  }

  async function loadRatings(force = false) {
    if (!force && state.ratings) return;
    state.ratings = await api('/api/ratings');
  }

  async function contactOrder(product, method) {
    try {
      const res = await api('/api/orders/contact', { method: 'POST', body: { productId: product.id || product.slug, method } });
      if (method === 'telegram') {
        await navigator.clipboard?.writeText(res.message || buildOrderMessage(product));
        notify('Format order disalin. Tempel di Telegram admin ya.');
      }
      const url = res.targetUrl || (method === 'telegram' ? telegramUrl() : whatsappUrl(buildOrderMessage(product)));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) { notify(error.message || 'Kontak gagal dibuka.'); }
  }

  async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers ? { ...options.headers } : {};
    const init = { method, credentials: 'include', headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    const res = await fetch(API_BASE + path, init);
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok || data.success === false) {
      const msg = data?.error?.message || `Request gagal (${res.status})`;
      if (!options.silent) console.warn(msg);
      throw new Error(msg);
    }
    return data;
  }

  async function adminFetch(path, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers ? { ...options.headers } : {};
    headers['X-CSRF-Token'] = state.csrfToken || sessionStorage.getItem('xlim_admin_csrf') || '';
    if (!['GET', 'HEAD'].includes(method.toUpperCase()) && !options.skipNonce) {
      headers['X-Request-Timestamp'] = String(Date.now());
      headers['X-Request-Nonce'] = cryptoNonce();
    }
    const init = { method, credentials: 'include', headers };
    if (options.formData) init.body = options.formData;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    const res = await fetch(API_BASE + path, init);
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok || data.success === false) throw new Error(data?.error?.message || `Request gagal (${res.status})`);
    return data;
  }

  function tableWrap(headers) {
    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table');
    const thead = el('thead');
    const hrow = el('tr');
    headers.forEach((h) => hrow.append(el('th', { text: h })));
    thead.append(hrow);
    const tbody = el('tbody');
    table.append(thead, tbody);
    wrap.append(table);
    return { wrap, table, tbody };
  }

  function cryptoNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function openModal(content) { modal.replaceChildren(content); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); modal.replaceChildren(); }
  function clearInvoicePoll() { if (state.invoicePoll) window.clearInterval(state.invoicePoll); state.invoicePoll = null; }
  function modalCard(title) {
    const card = el('section', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true' });
    const top = el('div', { class: 'modal-top' });
    top.append(el('h3', { text: title }), el('button', { class: 'btn small ghost', type: 'button', text: 'Tutup', 'data-close-modal': 'true' }));
    card.append(top);
    return card;
  }
  function notify(message) { toast.textContent = message || ''; toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 3100); }
  function showError(message) { app.replaceChildren(sectionPanel('Lagi error bentar', message || 'Coba reload halaman.')); }
  function sectionPanel(title, text) { const section = el('section', { class: 'section panel' }); section.append(el('div', { class: 'eyebrow', text: 'XLIMSTORE' }), el('h2', { text: title }), el('p', { text })); return section; }
  function statusCard(label, value) { const card = el('div', { class: 'status-card' }); card.append(el('b', { text: label }), el('span', { text: String(value) })); return card; }
  function step(n, title, text) { const item = el('div', { class: 'step' }); item.append(el('b', { text: n }), el('h3', { text: title }), el('p', { text })); return item; }
  function miniProduct(src, title, price) { const item = el('div', { class: 'mini-product' }); item.append(el('img', { src, alt: title, loading: 'lazy' }), div('', el('h3', { text: title }), el('p', { text: price }))); return item; }
  function reviewCard(item) { const card = el('article', { class: 'review' }); card.append(el('div', { class: 'avatar', text: initials(item.name) }), div('', el('strong', { text: item.name || 'Pembeli XLIM' }), el('p', { text: stars(item.rating) }), el('p', { text: item.comment || '' }))); return card; }
  function inputField(labelText, name, type, placeholder) { const wrap = el('label', { class: 'field' }); const span = el('span', { text: labelText }); const input = el('input', { name, type, placeholder }); wrap.append(span, input); return { wrap, input }; }
  function textareaField(labelText, name, placeholder) { const wrap = el('label', { class: 'field' }); const span = el('span', { text: labelText }); const input = el('textarea', { name, placeholder }); wrap.append(span, input); return { wrap, input }; }
  function selectField(labelText, name) { const wrap = el('label', { class: 'field' }); const span = el('span', { text: labelText }); const input = el('select', { name }); wrap.append(span, input); return { wrap, input }; }
  function option(value, label) { return el('option', { value, text: label }); }
  function button(text, className, onClick) { const btn = el('button', { type: 'button', class: className, text }); if (onClick) btn.addEventListener('click', onClick); return btn; }
  function buttonLink(href, text, className) { return el('a', { href, class: className, text, 'data-link': 'true' }); }
  function externalButton(text, href, className) { if (!href) return null; return el('a', { href, class: className, text, target: '_blank', rel: 'noopener noreferrer' }); }
  function div(className, ...children) { const node = el('div', { class: className }); children.filter(Boolean).forEach((child) => node.append(child)); return node; }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'text') node.textContent = String(value);
      else if (key === 'class') node.className = String(value);
      else if (key === 'html') node.innerHTML = String(value);
      else node.setAttribute(key, String(value));
    });
    children.filter(Boolean).forEach((child) => node.append(child));
    return node;
  }

  function invoiceRow(label, value, strong = false) { const row = el('div', { class: strong ? 'invoice-row strong' : 'invoice-row' }); row.append(el('span', { text: label }), el(strong ? 'strong' : 'b', { text: String(value || '-') })); return row; }
  function skeleton() { return el('div', { class: 'skeleton' }); }
  function imageSrc(product) { return product.imageUrl || product.image || '/assets/img/xlimstore-profile.webp'; }
  function statusText(status) { return ({ ready: 'Ready', soldout: 'Sold out', preorder: 'Preorder', inactive: 'Nonaktif' })[status] || 'Ready'; }
  function statusOrderText(status) { return ({ pending: 'Menunggu Pembayaran', paid: 'Pembayaran Berhasil', expired: 'Expired', cancelled: 'Dibatalkan', failed: 'Gagal' })[status] || 'Pending'; }
  function methodLabel(value) { return String(value || '-').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }
  function formatRupiah(amount) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount || 0)); }
  function stars(n) { return '★★★★★'.slice(0, Number(n || 0)) + '☆☆☆☆☆'.slice(0, Math.max(0, 5 - Number(n || 0))); }
  function initials(name) { return String(name || 'XL').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(); }
  function formatDateTime(date) { try { if (!date) return ''; return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)); } catch (_) { return ''; } }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function trimSlash(value) { return String(value || '').replace(/\/+$/, ''); }
  function telegramUrl() { return `https://t.me/${state.config.telegramUsername || 'xlimstor'}`; }
  function whatsappUrl(message) { const number = digits(state.config.whatsappNumber || CFG.WHATSAPP_NUMBER || '6283193075449'); return number ? `https://wa.me/${number}?text=${encodeURIComponent(message || 'Halo admin XLIMSTORE.')}` : '#'; }
  function openContact(method) { const msg = 'Halo admin XLIMSTORE, saya mau tanya produk.'; window.open(method === 'telegram' ? telegramUrl() : whatsappUrl(msg), '_blank', 'noopener,noreferrer'); }
  function buildOrderMessage(product) { return ['Halo admin XLIMSTORE, saya mau tanya/order:', `Produk: ${product.name}`, `Harga: ${product.priceLabel || formatRupiah(product.price)}`, `Kategori: ${product.category || '-'}`, `ID Produk: ${product.slug || product.id}`].join('\n'); }
  async function copyText(text) { await navigator.clipboard?.writeText(String(text || '')); notify('Disalin.'); }
  function setMeta(title, description) { document.title = title; setTag('meta[name="description"]', 'content', description); setTag('meta[property="og:title"]', 'content', title); setTag('meta[property="og:description"]', 'content', description); }
  function setTag(selector, attr, value) { const node = document.querySelector(selector); if (node) node.setAttribute(attr, value); }
})();
