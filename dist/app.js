(() => {
  'use strict';

  const CFG = window.XLIMSTORE_CONFIG || {};
  const API_BASE = trimSlash(CFG.API_BASE_URL || 'https://admin-xlim.alizz.my.id');
  const SITE_URL = trimSlash(CFG.SITE_URL || location.origin);
  const WA_NUMBER_FALLBACK = digits(CFG.WHATSAPP_NUMBER || '');
  const state = {
    route: normalizeRoute(location.pathname),
    products: [],
    productsLoadedAt: 0,
    config: null,
    user: null,
    csrfToken: sessionStorage.getItem('xlim_admin_csrf') || '',
    editingProduct: null,
  };

  const app = document.getElementById('app');
  const toast = document.getElementById('toast');
  const waFloat = document.getElementById('waFloat');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-link]');
    if (link && link.getAttribute('href')?.startsWith('/')) {
      event.preventDefault();
      navigate(link.getAttribute('href'));
      return;
    }
    const close = event.target.closest('[data-close-modal]');
    if (close) closeModal();
  });

  window.addEventListener('popstate', () => routeTo(normalizeRoute(location.pathname)));
  init();

  async function init() {
    await loadPublicConfig();
    await routeTo(state.route, true);
  }

  function normalizeRoute(pathname) {
    if (pathname === '/' || pathname === '') return '/demo';
    return ['/demo', '/produk', '/rating', '/admin'].includes(pathname) ? pathname : '/demo';
  }

  function navigate(path) {
    const route = normalizeRoute(path);
    history.pushState({}, '', route);
    routeTo(route);
  }

  async function routeTo(route, first = false) {
    state.route = route;
    updateNav();
    updateWhatsAppFloat();
    app.setAttribute('aria-busy', 'true');
    try {
      if (route === '/demo') renderDemo();
      if (route === '/produk') await renderProducts();
      if (route === '/rating') await renderRating();
      if (route === '/admin') await renderAdmin();
      if (!first) app.focus({ preventScroll: true });
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
      state.config = res.data || res;
    } catch (_) {
      state.config = {
        whatsappFloatingButton: true,
        whatsappNumber: WA_NUMBER_FALLBACK,
        googleLoginEnabled: false,
        pakasirEnabled: false,
        checkoutMode: 'whatsapp_only',
      };
    }
  }

  function updateWhatsAppFloat() {
    const shouldShow = ['/demo', '/produk'].includes(state.route) && (state.config?.whatsappFloatingButton !== false);
    waFloat.classList.toggle('hidden', !shouldShow);
    waFloat.onclick = () => {
      const number = digits(state.config?.whatsappNumber || WA_NUMBER_FALLBACK);
      if (!number || number.includes('x')) return notify('Nomor WhatsApp belum di-set di config/env backend.');
      window.open(`https://wa.me/${number}?text=${encodeURIComponent('Halo admin XLIMSTORE, saya mau tanya produk.')}`, '_blank', 'noopener,noreferrer');
    };
  }

  function renderDemo() {
    setMeta('XLIMSTORE — Cara Order Produk Digital', 'Cara order di XLIMSTORE: cek produk, pilih item, lanjut pembayaran atau chat admin resmi.');
    app.replaceChildren();
    const hero = el('section', { class: 'hero' });
    const card = el('div', { class: 'hero-card' });
    card.append(
      el('div', { class: 'eyebrow', text: 'XLIMSTORE MINI APP' }),
      el('h1', { text: 'Produk digital, order sat-set.' }),
      el('p', { text: 'Pilih produk, cek detail, lanjut order. Stok ready, admin resmi, dan checkout sudah disiapkan buat WhatsApp sekarang serta Pakasir nanti.' }),
      div('hero-actions',
        buttonLink('/produk', 'Lihat produk', 'btn primary'),
        buttonLink('/rating', 'Cek rating', 'btn ghost')
      )
    );
    const phone = el('div', { class: 'phone-preview' });
    const screen = el('div', { class: 'screen' });
    screen.append(
      div('mini-header', el('span', { class: 'mini-chip', text: 'Ready stock' }), el('span', { class: 'mini-chip', text: 'Fast response' })),
      miniProduct('/assets/img/product-akun-ff-15k.webp', 'Akun FF Google 15K', 'Rp 15.000'),
      miniProduct('/assets/img/product-sewa-bot-whatsapp.webp', 'Sewa Bot WhatsApp', 'Mulai Rp 5.000'),
      miniProduct('/assets/img/product-nokos-whatsapp.webp', 'Nokos WhatsApp Indonesia', 'Rp 5.000')
    );
    phone.append(screen);
    hero.append(card, phone);

    const steps = sectionPanel('Cara order', 'Simple, nggak muter-muter. Kamu bisa tanya admin dulu atau langsung order dari katalog.');
    const grid = el('div', { class: 'steps' });
    [
      ['1', 'Cek katalog', 'Buka halaman produk, cari item yang kamu butuh.'],
      ['2', 'Baca detail', 'Klik detail buat lihat harga, fitur, dan status stok.'],
      ['3', 'Order', 'Lanjut WhatsApp fallback atau pembayaran Pakasir kalau sudah aktif.'],
      ['4', 'Garansi', 'Simpan order ID dan ikuti arahan admin resmi.']
    ].forEach(([n, title, text]) => grid.append(step(n, title, text)));
    steps.append(grid);

    const info = el('section', { class: 'section panel' });
    info.append(
      el('div', { class: 'eyebrow', text: 'Info aman' }),
      el('h2', { text: 'Admin resmi, transaksi lebih aman.' }),
      el('p', { text: 'Admin cuma dari tombol WhatsApp di website ini. Jangan percaya akun random yang ngaku-ngaku. Kalau katalog lagi ngambek, coba reload bentar atau chat admin.' }),
      div('row-actions', buttonLink('/produk', 'Gas ke katalog', 'btn primary'), externalButton('Chat admin', adminWaUrl(), 'btn ghost'))
    );

    const faq = sectionPanel('FAQ singkat', 'Yang sering ditanyain sebelum order.');
    const list = el('div', { class: 'faq' });
    [
      ['Bayarnya gimana?', 'Saat ini bisa via WhatsApp admin. Pakasir siap diaktifkan lewat .env kalau data API sudah ada.'],
      ['Garansi berlaku?', 'Ikuti detail garansi di masing-masing produk dan arahan admin saat order.'],
      ['Produk bisa habis?', 'Bisa. Status di katalog bisa diedit admin tanpa ubah kode.'],
      ['Admin ada di menu?', 'Tidak. Halaman admin sengaja disembunyikan dari UI publik.']
    ].forEach(([q, a]) => list.append(faqItem(q, a)));
    faq.append(list);

    app.append(hero, steps, info, faq);
  }

  async function renderProducts() {
    setMeta('Produk XLIMSTORE — Akun FF, Nokos, Bot WhatsApp', 'Katalog XLIMSTORE untuk akun FF, nokos WhatsApp Indonesia, sewa bot WhatsApp, dan produk digital lain.');
    app.replaceChildren(sectionPanel('Katalog lagi loading...', 'Sebentar, produk lagi ditarik dari server.'));
    await loadProducts();
    app.replaceChildren();

    const head = el('section', { class: 'section panel' });
    head.append(
      el('div', { class: 'eyebrow', text: 'KATALOG XLIMSTORE' }),
      el('h2', { text: 'Pilih produk, cek detail, lanjut order sat-set.' }),
      el('p', { text: 'Produk default bisa diedit dari admin. Produk baru juga otomatis bisa dipakai checkout WhatsApp/Pakasir tanpa ubah kode.' })
    );

    const toolbar = el('div', { class: 'toolbar' });
    const search = inputField('Cari produk', 'search', 'search', 'Cari akun FF, nokos, bot...');
    const cat = selectField('Kategori', 'category');
    const sort = selectField('Urutkan', 'sort');
    toolbar.append(search.wrap, cat.wrap, sort.wrap);

    const categories = ['Semua', ...new Set(state.products.map((p) => p.category).filter(Boolean))];
    categories.forEach((item) => cat.input.append(option(item, item)));
    [['popular', 'Rekomendasi'], ['cheap', 'Harga termurah'], ['expensive', 'Harga tertinggi'], ['name', 'Nama A-Z']].forEach(([value, label]) => sort.input.append(option(value, label)));

    const grid = el('div', { class: 'grid', id: 'productGrid' });
    const rerender = () => renderProductGrid(grid, search.input.value, cat.input.value, sort.input.value);
    [search.input, cat.input, sort.input].forEach((item) => item.addEventListener('input', rerender));
    head.append(toolbar);
    app.append(head, grid);
    renderProductGrid(grid, new URLSearchParams(location.search).get('q') || '', 'Semua', 'popular');
    if (new URLSearchParams(location.search).get('q')) search.input.value = new URLSearchParams(location.search).get('q');
  }

  async function loadProducts(force = false) {
    const cacheKey = 'xlim_products_cache_v3';
    const cacheTtl = 60 * 1000;
    if (!force && state.products.length && Date.now() - state.productsLoadedAt < cacheTtl) return;
    if (!force) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.time < cacheTtl && Array.isArray(cached.products)) {
          state.products = cached.products;
          state.productsLoadedAt = cached.time;
          return;
        }
      } catch (_) {}
    }
    const res = await api('/api/products');
    const products = res.products || res.data || [];
    state.products = Array.isArray(products) ? products : [];
    state.productsLoadedAt = Date.now();
    sessionStorage.setItem(cacheKey, JSON.stringify({ time: state.productsLoadedAt, products: state.products }));
  }

  function renderProductGrid(grid, query = '', category = 'Semua', sort = 'popular') {
    const q = query.trim().toLowerCase();
    let products = state.products.filter((p) => {
      const matchQ = !q || [p.name, p.category, p.caption, p.description].join(' ').toLowerCase().includes(q);
      const matchC = category === 'Semua' || p.category === category;
      return matchQ && matchC;
    });
    if (sort === 'cheap') products.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'expensive') products.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') products.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    grid.replaceChildren();
    if (!products.length) {
      grid.append(el('div', { class: 'empty-state', text: 'Katalog lagi ngambek atau produk nggak ketemu. Coba kata kunci lain ya.' }));
      return;
    }
    products.forEach((product) => grid.append(productCard(product)));
  }

  function productCard(product) {
    const card = el('article', { class: 'product-card' });
    const media = el('div', { class: 'product-media' });
    media.append(el('img', { src: imageUrl(product.imageUrl || product.image), alt: product.name, loading: 'lazy', width: '420', height: '320' }));
    const body = el('div', { class: 'product-body' });
    const title = div('product-title', el('h3', { text: product.name }), el('span', { class: `badge ${product.status || 'ready'}`, text: statusLabel(product.status) }));
    const price = el('div', { class: 'price', text: product.priceDisplay || rupiah(product.price) });
    const desc = el('p', { text: product.caption || product.description || 'Detail produk siap dicek.' });
    const notes = el('ul', { class: 'notes' });
    (product.notes || []).slice(0, 4).forEach((note) => notes.append(el('li', { text: note })));
    const actions = div('row-actions', button('Detail', 'btn ghost small', () => openProductModal(product)), button('Order', 'btn primary small', () => orderProduct(product)));
    body.append(title, price, desc, notes, actions);
    card.append(media, body);
    return card;
  }

  function openProductModal(product) {
    const modal = ensureModal();
    const card = el('div', { class: 'modal-card' });
    const notes = el('ul', { class: 'notes' });
    (product.notes || []).forEach((note) => notes.append(el('li', { text: note })));
    card.append(
      div('modal-top', el('h2', { text: product.name }), button('Tutup', 'btn ghost small', closeModal, { 'data-close-modal': '1' })),
      el('img', { src: imageUrl(product.imageUrl || product.image), alt: product.name, loading: 'lazy', width: '720', height: '420', style: 'border-radius:18px;object-fit:cover;max-height:360px;width:100%;' }),
      el('p', { text: product.description || product.caption || 'Detail produk bisa ditanyakan ke admin.' }),
      el('div', { class: 'price', text: product.priceDisplay || rupiah(product.price) }),
      notes,
      div('row-actions', button('Order sekarang', 'btn primary', () => orderProduct(product)), externalButton('Tanya admin', adminWaUrl(`Halo admin XLIMSTORE, saya mau tanya ${product.name}.`), 'btn ghost'))
    );
    modal.replaceChildren(card);
    modal.classList.add('open');
  }

  async function orderProduct(product) {
    try {
      const res = await api('/api/orders', { method: 'POST', body: { productId: product.id } });
      const order = res.order || res.data || {};
      notify(res.message || 'Order dibuat.');
      const target = order.paymentUrl || order.whatsappUrl;
      if (target) window.open(target, '_blank', 'noopener,noreferrer');
      else notify('Order masuk, tapi link belum tersedia. Chat admin dari tombol WhatsApp.');
    } catch (error) {
      notify(error.message || 'Order gagal. Coba lagi bentar.');
    }
  }

  async function renderRating() {
    setMeta('Rating XLIMSTORE — Testimoni Customer', 'Lihat dan beri rating untuk XLIMSTORE. Rating aman dengan anti-spam dan sanitasi input.');
    app.replaceChildren(sectionPanel('Rating lagi loading...', 'Sebentar, data testimoni lagi ditarik.'));
    const [ratingRes, meRes] = await Promise.allSettled([api('/api/ratings'), api('/api/auth/me', { silent: true })]);
    const data = ratingRes.status === 'fulfilled' ? (ratingRes.value.data || ratingRes.value) : { average: 0, count: 0, latest: [] };
    state.user = meRes.status === 'fulfilled' ? (meRes.value.data?.user || meRes.value.data || null) : null;
    const googleEnabled = Boolean(state.config?.googleLoginEnabled);
    app.replaceChildren();

    const summary = el('section', { class: 'section panel rating-summary' });
    summary.append(
      div('rating-big', el('strong', { text: data.average ? data.average.toFixed(1) : '0.0' }), el('span', { text: `dari ${data.count || 0} rating` }), el('p', { text: 'Makasih buat yang sudah trust XLIMSTORE.' })),
      div('', el('div', { class: 'eyebrow', text: 'RATING WEBSITE' }), el('h2', { text: 'Kasih nilai buat XLIMSTORE.' }), el('p', { text: googleEnabled ? 'Google Login aktif: login dulu biar nama dan foto profil kamu otomatis tampil.' : 'Google Login nonaktif: isi nama manual, tetap ada anti-spam.' }))
    );

    const formPanel = el('section', { class: 'section panel' });
    const form = el('form');
    const rating = selectField('Rating', 'rating');
    [['5', '★★★★★ Mantap'], ['4', '★★★★ Bagus'], ['3', '★★★ Oke'], ['2', '★★ Kurang'], ['1', '★ Perlu diperbaiki']].forEach(([v, t]) => rating.input.append(option(v, t)));
    const name = inputField('Nama', 'name', 'text', 'Nama kamu');
    const comment = textareaField('Komentar', 'comment', 'Tulis pengalaman kamu...');
    if (state.user) name.input.value = state.user.name || '';
    if (state.user || googleEnabled) name.input.disabled = Boolean(state.user || googleEnabled);
    form.append(div('form-row', rating.wrap, name.wrap), comment.wrap, div('row-actions', button('Kirim rating', 'btn primary', null, { type: 'submit' }), googleEnabled && !state.user ? externalButton('Login Google', `${API_BASE}/api/auth/google`, 'btn ghost') : null));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/api/ratings', { method: 'POST', body: { rating: rating.input.value, name: name.input.value, comment: comment.input.value } });
        notify('Makasih! Rating kamu sudah masuk.');
        renderRating();
      } catch (error) {
        notify(error.message || 'Rating gagal dikirim.');
      }
    });
    formPanel.append(el('h2', { text: 'Tulis rating' }), form);

    const latest = sectionPanel('Rating terbaru', 'Komentar ditampilkan aman tanpa HTML mentah.');
    const list = el('div', { class: 'rating-list' });
    (data.latest || []).forEach((item) => list.append(reviewItem(item)));
    if (!(data.latest || []).length) list.append(el('div', { class: 'empty-state', text: 'Belum ada rating. Jadilah yang pertama.' }));
    latest.append(list);
    app.append(summary, formPanel, latest);
  }

  async function renderAdmin() {
    setMeta('XLIMSTORE Admin', 'Halaman admin XLIMSTORE tersembunyi.');
    app.replaceChildren(sectionPanel('Admin loading...', 'Cek sesi admin dulu.'));
    let session = null;
    try { session = await api('/api/admin/session', { silent: true }); } catch (_) {}
    const authenticated = Boolean(session?.data?.authenticated);
    if (authenticated) state.csrfToken = session.data.csrfToken || state.csrfToken;
    if (state.csrfToken) sessionStorage.setItem('xlim_admin_csrf', state.csrfToken);
    if (!authenticated) return renderAdminLogin();
    return renderAdminPanel();
  }

  function renderAdminLogin() {
    app.replaceChildren();
    const wrap = el('section', { class: 'section panel', style: 'max-width:520px;margin-inline:auto;' });
    const key = inputField('Admin Key', 'adminKey', 'password', 'Masukkan key admin');
    const pass = inputField('Admin Password', 'adminPassword', 'password', 'Masukkan password admin');
    const form = el('form');
    form.append(
      el('div', { class: 'eyebrow', text: 'ADMIN AREA' }),
      el('h2', { text: 'Login admin XLIMSTORE' }),
      el('p', { text: 'Halaman ini sengaja tidak muncul di menu publik. Login pakai key + password.' }),
      key.wrap,
      pass.wrap,
      div('row-actions', button('Masuk admin', 'btn primary', null, { type: 'submit' }))
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const res = await api('/api/admin/login', { method: 'POST', body: { key: key.input.value, password: pass.input.value } });
        state.csrfToken = res.data?.csrfToken || res.csrfToken || '';
        sessionStorage.setItem('xlim_admin_csrf', state.csrfToken);
        notify('Login admin berhasil.');
        renderAdminPanel();
      } catch (error) {
        notify(error.message || 'Login gagal.');
      }
    });
    wrap.append(form);
    app.append(wrap);
  }

  async function renderAdminPanel() {
    app.replaceChildren(sectionPanel('Admin panel loading...', 'Tarik produk, rating, dan order terbaru.'));
    const [productsRes, statusRes] = await Promise.all([api('/api/admin/products'), api('/api/admin/status')]);
    const products = productsRes.products || productsRes.data || [];
    const status = statusRes.data || {};
    app.replaceChildren();
    const wrap = el('section', { class: 'admin-wrap section' });
    wrap.append(
      div('panel', el('div', { class: 'eyebrow', text: 'ADMIN DASHBOARD' }), el('h2', { text: 'Kelola XLIMSTORE' }), el('p', { text: 'Tambah, edit, hapus produk; upload gambar; cek mode checkout, Google Login, Pakasir, rating, dan order.' }), adminStatus(status), div('row-actions', button('Logout', 'btn ghost', adminLogout)))
    );
    const grid = el('div', { class: 'admin-grid' });
    grid.append(productForm(), productTable(products));
    wrap.append(grid, latestAdmin(status));
    app.append(wrap);
  }

  function adminStatus(status) {
    const cfg = status.config || state.config || {};
    const box = div('row-actions');
    box.append(
      el('span', { class: 'mini-chip', text: `Checkout: ${cfg.checkoutMode || '-'}` }),
      el('span', { class: 'mini-chip', text: `Google: ${cfg.googleLoginEnabled ? 'aktif' : 'nonaktif'}` }),
      el('span', { class: 'mini-chip', text: `Pakasir: ${cfg.pakasirEnabled ? 'aktif' : 'nonaktif'}` }),
      el('span', { class: 'mini-chip', text: `Produk: ${status.counts?.products ?? 0}` }),
      el('span', { class: 'mini-chip', text: `Order: ${status.counts?.orders ?? 0}` })
    );
    return box;
  }

  function productForm(product = state.editingProduct) {
    const box = el('div', { class: 'admin-box' });
    const name = inputField('Nama produk', 'pName', 'text', 'Akun FF Sultan');
    const category = inputField('Kategori', 'pCat', 'text', 'Akun FF');
    const price = inputField('Harga angka', 'pPrice', 'number', '150000');
    const priceDisplay = inputField('Harga display', 'pPriceDisplay', 'text', 'Rp 150.000');
    const image = inputField('URL/path gambar', 'pImage', 'text', '/uploads/nama-file.webp');
    const upload = inputField('Upload gambar', 'pUpload', 'file', '');
    const status = selectField('Status', 'pStatus');
    ['ready', 'sold', 'preorder', 'restock'].forEach((item) => status.input.append(option(item, statusLabel(item))));
    const caption = inputField('Caption pendek', 'pCaption', 'text', 'Stok ready, tinggal gas.');
    const desc = textareaField('Deskripsi', 'pDesc', 'Detail produk...');
    const notes = textareaField('Fitur/catatan (1 baris per item)', 'pNotes', 'FULL GARANSI\nBIND KOSONG');

    if (product) {
      name.input.value = product.name || '';
      category.input.value = product.category || '';
      price.input.value = product.price || 0;
      priceDisplay.input.value = product.priceDisplay || '';
      image.input.value = product.image || product.imageUrl || '';
      status.input.value = product.status || 'ready';
      caption.input.value = product.caption || '';
      desc.input.value = product.description || '';
      notes.input.value = (product.notes || []).join('\n');
    }

    upload.input.accept = 'image/jpeg,image/png,image/webp';
    upload.input.addEventListener('change', async () => {
      if (!upload.input.files?.[0]) return;
      try {
        const fd = new FormData();
        fd.append('image', upload.input.files[0]);
        const res = await api('/api/admin/upload', { method: 'POST', formData: fd });
        image.input.value = res.data?.path || res.data?.url || '';
        notify('Gambar berhasil di-upload.');
      } catch (error) {
        notify(error.message || 'Upload gagal.');
      }
    });

    const form = el('form');
    form.append(
      el('h3', { text: product ? 'Edit produk' : 'Tambah produk' }),
      name.wrap, div('form-row', category.wrap, price.wrap), priceDisplay.wrap, image.wrap, upload.wrap, status.wrap, caption.wrap, desc.wrap, notes.wrap,
      div('row-actions', button(product ? 'Simpan edit' : 'Tambah produk', 'btn primary', null, { type: 'submit' }), product ? button('Batal edit', 'btn ghost', () => { state.editingProduct = null; renderAdminPanel(); }) : null)
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: name.input.value,
        category: category.input.value,
        price: price.input.value,
        priceDisplay: priceDisplay.input.value,
        image: image.input.value,
        status: status.input.value,
        caption: caption.input.value,
        description: desc.input.value,
        notes: notes.input.value.split('\n').map((x) => x.trim()).filter(Boolean),
      };
      try {
        if (product) await api(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'PUT', body: payload });
        else await api('/api/admin/products', { method: 'POST', body: payload });
        sessionStorage.removeItem('xlim_products_cache_v3');
        state.products = [];
        state.editingProduct = null;
        notify(product ? 'Produk berhasil di-update.' : 'Produk berhasil ditambah.');
        renderAdminPanel();
      } catch (error) {
        notify(error.message || 'Produk gagal disimpan.');
      }
    });
    box.append(form);
    return box;
  }

  function productTable(products) {
    const box = el('div', { class: 'admin-box' });
    box.append(el('h3', { text: 'Daftar produk' }));
    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table');
    table.append(row(['Produk', 'Kategori', 'Harga', 'Status', 'Aksi'], 'th'));
    const body = el('tbody');
    products.forEach((p) => {
      const tr = el('tr');
      tr.append(td(p.name), td(p.category), td(p.priceDisplay || rupiah(p.price)), td(statusLabel(p.status)));
      const actions = el('td');
      actions.append(div('row-actions', button('Edit', 'btn ghost small', () => { state.editingProduct = p; renderAdminPanel(); }), button('Hapus', 'btn danger small', async () => {
        if (!confirm(`Hapus ${p.name}?`)) return;
        try {
          await api(`/api/admin/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
          sessionStorage.removeItem('xlim_products_cache_v3');
          notify('Produk dihapus.');
          renderAdminPanel();
        } catch (error) { notify(error.message || 'Gagal hapus.'); }
      })));
      tr.append(actions);
      body.append(tr);
    });
    table.append(body);
    wrap.append(table);
    box.append(wrap);
    return box;
  }

  function latestAdmin(status) {
    const box = el('div', { class: 'admin-box' });
    box.append(el('h3', { text: 'Terbaru' }));
    const wrap = el('div', { class: 'table-wrap' });
    const table = el('table');
    table.append(row(['Tipe', 'Info', 'Waktu'], 'th'));
    const body = el('tbody');
    (status.latestOrders || []).forEach((o) => body.append(row(['Order', `${o.productName} · ${rupiah(o.amount)} · ${o.status}`, dateShort(o.createdAt)])));
    (status.latestRatings || []).forEach((r) => body.append(row(['Rating', `${r.name}: ${r.rating}/5 — ${r.comment}`, dateShort(r.createdAt)])));
    if (!body.children.length) body.append(row(['-', 'Belum ada aktivitas terbaru.', '-']));
    table.append(body); wrap.append(table); box.append(wrap); return box;
  }

  async function adminLogout() {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch (_) {}
    sessionStorage.removeItem('xlim_admin_csrf');
    state.csrfToken = '';
    renderAdminLogin();
  }

  async function api(path, opts = {}) {
    const headers = {};
    const init = { method: opts.method || 'GET', credentials: 'include', headers };
    if (opts.formData) {
      init.body = opts.formData;
      if (state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
      if (state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
    }
    const res = await fetch(`${API_BASE}${path}`, init);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || data?.success === false) {
      const msg = data?.error?.message || data?.message || `Request gagal (${res.status})`;
      throw new Error(msg);
    }
    return data || {};
  }

  function setMeta(title, desc) {
    document.title = title;
    setMetaTag('description', desc);
    setMetaProp('og:title', title);
    setMetaProp('og:description', desc);
    setMetaProp('og:url', `${SITE_URL}${state.route}`);
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', desc);
  }

  function setMetaTag(name, content) {
    const tag = document.querySelector(`meta[name="${name}"]`);
    if (tag) tag.setAttribute('content', content);
  }

  function setMetaProp(prop, content) {
    const tag = document.querySelector(`meta[property="${prop}"]`);
    if (tag) tag.setAttribute('content', content);
  }

  function imageUrl(value) {
    const raw = String(value || '');
    if (raw.startsWith('/uploads/')) return `${API_BASE}${raw}`;
    if (raw.startsWith('/assets/')) return raw;
    if (/^https?:\/\//.test(raw)) return raw;
    return '/assets/img/xlimstore-profile.webp';
  }

  function adminWaUrl(text = 'Halo admin XLIMSTORE, saya mau tanya produk.') {
    const number = digits(state.config?.whatsappNumber || WA_NUMBER_FALLBACK);
    if (!number || number.includes('x')) return '#';
    return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }

  function ensureModal() {
    let modal = document.getElementById('modal');
    if (!modal) {
      modal = el('div', { id: 'modal', class: 'modal', role: 'dialog', 'aria-modal': 'true' });
      modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
      document.body.append(modal);
    }
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.classList.remove('open');
  }

  function sectionPanel(title, subtitle) {
    const sec = el('section', { class: 'section panel' });
    sec.append(el('h2', { text: title }), el('p', { text: subtitle }));
    return sec;
  }

  function step(n, title, text) {
    const item = el('article', { class: 'step' });
    item.append(el('b', { text: n }), el('h3', { text: title }), el('p', { text }));
    return item;
  }

  function faqItem(q, a) {
    const d = el('details');
    d.append(el('summary', { text: q }), el('p', { text: a }));
    return d;
  }

  function miniProduct(src, title, price) {
    const item = el('div', { class: 'mini-product' });
    item.append(el('img', { src, alt: title, loading: 'lazy', width: '74', height: '74' }), div('', el('strong', { text: title }), el('p', { text: price })));
    return item;
  }

  function reviewItem(item) {
    const card = el('article', { class: 'review' });
    const avatar = el('div', { class: 'avatar' });
    if (item.avatar) avatar.append(el('img', { src: imageUrl(item.avatar), alt: '', loading: 'lazy' }));
    else avatar.textContent = (item.name || 'C').slice(0, 1).toUpperCase();
    card.append(avatar, div('', div('product-title', el('strong', { text: item.name || 'Customer XLIM' }), el('span', { class: 'mini-chip', text: `${item.rating}/5` })), el('p', { text: item.comment || '' }), el('small', { text: dateShort(item.createdAt) })));
    return card;
  }

  function inputField(labelText, id, type, placeholder) {
    const wrap = el('div', { class: 'field' });
    const label = el('label', { for: id, text: labelText });
    const input = el('input', { id, type, placeholder });
    wrap.append(label, input);
    return { wrap, input };
  }

  function textareaField(labelText, id, placeholder) {
    const wrap = el('div', { class: 'field' });
    const label = el('label', { for: id, text: labelText });
    const input = el('textarea', { id, placeholder });
    wrap.append(label, input);
    return { wrap, input };
  }

  function selectField(labelText, id) {
    const wrap = el('div', { class: 'field' });
    const label = el('label', { for: id, text: labelText });
    const input = el('select', { id });
    wrap.append(label, input);
    return { wrap, input };
  }

  function option(value, text) {
    const o = el('option', { value, text });
    return o;
  }

  function button(text, cls, onClick, attrs = {}) {
    const b = el('button', { class: cls, type: attrs.type || 'button', text });
    Object.entries(attrs).forEach(([k, v]) => { if (k !== 'type') b.setAttribute(k, v); });
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function buttonLink(href, text, cls) {
    const a = el('a', { href, class: cls, text });
    a.setAttribute('data-link', '');
    return a;
  }

  function externalButton(text, href, cls) {
    if (!href || href === '#') return button(text, cls, () => notify('Nomor WhatsApp belum di-set.'));
    const a = el('a', { href, class: cls, text, target: '_blank', rel: 'noopener noreferrer' });
    return a;
  }

  function row(values, cell = 'td') {
    const tr = el('tr');
    values.forEach((value) => tr.append(el(cell, { text: String(value ?? '') })));
    return tr;
  }

  function td(text) { return el('td', { text: String(text ?? '') }); }

  function div(cls, ...children) {
    const d = el('div', { class: cls });
    children.filter(Boolean).forEach((child) => d.append(child));
    return d;
  }

  function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key === 'for') node.htmlFor = value;
      else if (key === 'style') node.setAttribute('style', value);
      else node.setAttribute(key, value);
    });
    return node;
  }

  function rupiah(amount) { return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`; }
  function statusLabel(status) { return ({ ready: 'Ready', sold: 'Sold', preorder: 'Preorder', restock: 'Restock' }[status] || status || 'Ready'); }
  function dateShort(value) { return value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'; }
  function trimSlash(value) { return String(value || '').replace(/\/+$/, ''); }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 3600);
  }

  function showError(message) {
    app.replaceChildren(sectionPanel('Katalog lagi ngambek', message));
  }
})();
