(() => {
  'use strict';

  const CFG = window.XLIMSTORE_CONFIG || {};
  const API_BASE = trimSlash(CFG.API_BASE_URL || '');
  const SITE_URL = trimSlash(CFG.SITE_URL || location.origin);
  const state = {
    route: normalizeRoute(location.pathname),
    products: [],
    productsLoadedAt: 0,
    ratings: null,
    config: {
      whatsappNumber: digits(CFG.WHATSAPP_NUMBER || ''),
      telegramUsername: String(CFG.TELEGRAM_USERNAME || 'xlimstor').replace(/^@/, ''),
      features: { manualOrder: true },
    },
    csrfToken: sessionStorage.getItem('xlim_admin_csrf') || '',
    adminAuthed: false,
    editingProduct: null,
  };

  const app = document.getElementById('app');
  const toast = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const contactFloat = document.getElementById('contactFloat');
  const floatWa = document.getElementById('floatWa');
  const floatTg = document.getElementById('floatTg');

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
    updateContactFloat();
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
      state.config = { ...state.config, ...(res.config || {}) };
    } catch (_) {}
  }
  function updateContactFloat() {
    const shouldShow = ['/demo', '/produk'].includes(state.route);
    contactFloat.classList.toggle('hidden', !shouldShow);
    floatWa.onclick = () => openContact('whatsapp');
    floatTg.onclick = () => openContact('telegram');
  }

  function renderDemo() {
    setMeta('XLIMSTORE — Cara Order Produk Digital', 'Cara order di XLIMSTORE: cek produk, pilih item, lalu chat admin resmi via WhatsApp atau Telegram.');
    app.replaceChildren();
    const hero = el('section', { class: 'hero' });
    const card = el('div', { class: 'hero-card' });
    card.append(
      el('div', { class: 'eyebrow', text: 'XLIMSTORE MINI APP' }),
      el('h1', { text: 'Produk digital, order sat-set.' }),
      el('p', { text: 'Cek katalog, pilih produk, terus chat admin resmi via WhatsApp atau Telegram. Backend sekarang full Vercel + Supabase, jadi nggak bergantung VPS lama.' }),
      div('hero-actions', buttonLink('/produk', 'Lihat produk', 'btn primary'), buttonLink('/rating', 'Cek rating', 'btn ghost'))
    );
    const phone = el('div', { class: 'phone-preview' });
    const screen = el('div', { class: 'screen' });
    screen.append(
      div('mini-header', el('span', { class: 'mini-chip', text: 'Ready stock' }), el('span', { class: 'mini-chip', text: 'WA + Telegram' })),
      miniProduct('/assets/img/product-akun-ff-15k.webp', 'Akun FF Google 15K', 'Rp 15.000'),
      miniProduct('/assets/img/product-sewa-bot-whatsapp.webp', 'Sewa Bot WhatsApp', 'Mulai Rp 5.000'),
      miniProduct('/assets/img/product-nokos-whatsapp.webp', 'Nokos WhatsApp Indonesia', 'Rp 5.000')
    );
    phone.append(screen);
    hero.append(card, phone);

    const steps = sectionPanel('Cara order', 'Simple, nggak muter-muter. Kamu bisa tanya admin dulu atau langsung kirim format order dari katalog.');
    const grid = el('div', { class: 'steps' });
    [
      ['1', 'Cek katalog', 'Buka halaman produk, cari item yang kamu butuh.'],
      ['2', 'Baca detail', 'Klik detail buat lihat harga, fitur, dan status stok.'],
      ['3', 'Pilih kontak', 'Order via WhatsApp atau Telegram admin resmi.'],
      ['4', 'Ikuti arahan', 'Admin bantu cek stok, pembayaran, dan garansi.']
    ].forEach(([n, title, text]) => grid.append(step(n, title, text)));
    steps.append(grid);

    const info = el('section', { class: 'section panel' });
    info.append(
      el('div', { class: 'eyebrow', text: 'Info aman' }),
      el('h2', { text: 'Admin resmi, transaksi lebih aman.' }),
      el('p', { text: 'Link admin hanya dari tombol kontak website ini. Jangan percaya akun random yang ngaku-ngaku. Kalau katalog lagi ngambek, coba reload bentar atau chat admin.' }),
      div('row-actions', buttonLink('/produk', 'Gas ke katalog', 'btn primary'), externalButton('WhatsApp', whatsappUrl('Halo admin XLIMSTORE, saya mau tanya produk.'), 'btn ghost'), externalButton('Telegram', telegramUrl(), 'btn cyan'))
    );

    const faq = sectionPanel('FAQ singkat', 'Yang sering ditanyain sebelum order.');
    const list = el('div', { class: 'faq' });
    [
      ['Bayarnya gimana?', 'Saat ini order manual via WhatsApp atau Telegram. Admin akan kasih arahan pembayaran.'],
      ['Garansi berlaku?', 'Ikuti detail garansi di masing-masing produk dan arahan admin saat order.'],
      ['Produk bisa habis?', 'Bisa. Status di katalog bisa diedit admin tanpa ubah kode.'],
      ['Admin ada di menu?', 'Tidak. Halaman admin sengaja disembunyikan dari UI publik.']
    ].forEach(([q, a]) => list.append(faqItem(q, a)));
    faq.append(list);

    app.append(hero, steps, info, faq);
  }

  async function renderProducts() {
    setMeta('Produk XLIMSTORE — Akun FF, Nokos, Bot WhatsApp', 'Katalog XLIMSTORE untuk akun FF, nokos WhatsApp Indonesia, sewa bot WhatsApp, dan produk digital lain.');
    app.replaceChildren(sectionPanel('Katalog lagi loading...', 'Sebentar, produk lagi ditarik dari Supabase.'));
    await loadProducts();
    app.replaceChildren();
    const head = el('section', { class: 'section panel' });
    head.append(
      el('div', { class: 'eyebrow', text: 'KATALOG XLIMSTORE' }),
      el('h2', { text: 'Pilih produk, cek detail, lanjut order sat-set.' }),
      el('p', { text: 'Produk tersimpan di Supabase. Admin bisa tambah, edit, upload gambar, dan nonaktifkan produk tanpa VPS.' })
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
    const q = new URLSearchParams(location.search).get('q') || '';
    search.input.value = q;
    renderProductGrid(grid, q, 'Semua', 'popular');
  }

  async function renderRating() {
    setMeta('Rating XLIMSTORE — Testimoni Pembeli', 'Kasih rating untuk XLIMSTORE dan baca komentar terbaru dari pembeli.');
    app.replaceChildren(sectionPanel('Rating lagi loading...', 'Ngambil testimoni terbaru dulu.'));
    await loadRatings();
    app.replaceChildren();
    const panel = sectionPanel('Rating website', 'Kasih bintang dan komentar singkat. Cukup isi nama manual.');
    const form = el('form', { class: 'toolbar', id: 'ratingForm' });
    const name = inputField('Nama', 'name', 'text', 'Nama kamu');
    const rating = selectField('Bintang', 'rating');
    [5,4,3,2,1].forEach((n) => rating.input.append(option(String(n), `${n} bintang`)));
    const comment = textareaField('Komentar', 'comment', 'Tulis pengalaman kamu...');
    const submit = el('button', { class: 'btn primary', type: 'submit', text: 'Kirim rating' });
    form.append(name.wrap, rating.wrap, comment.wrap, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await api('/api/ratings', { method: 'POST', body: { name: name.input.value, rating: Number(rating.input.value), comment: comment.input.value } });
        notify('Rating masuk. Makasih sudah mampir!');
        form.reset();
        await loadRatings(true);
        await renderRating();
      } catch (error) { notify(error.message); }
      finally { submit.disabled = false; }
    });
    panel.append(form);

    const summary = el('section', { class: 'section panel' });
    const average = state.ratings?.average || 0;
    const count = state.ratings?.count || 0;
    const ratings = state.ratings?.ratings || [];
    const big = el('div', { class: 'rating-big' });
    big.append(el('strong', { text: average ? String(average) : '0' }), el('p', { text: `${stars(Math.round(average || 0))} · ${count} rating` }));
    const list = el('div', { class: 'rating-list' });
    if (!ratings.length) list.append(el('div', { class: 'empty-state', text: 'Belum ada rating. Jadi yang pertama, gas!' }));
    ratings.forEach((item) => list.append(reviewCard(item)));
    summary.append(el('div', { class: 'eyebrow', text: 'TESTIMONI' }), el('h2', { text: 'Apa kata pembeli?' }), div('rating-summary', big, list));
    app.append(panel, summary);
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
    if (!products.length) return grid.append(el('div', { class: 'empty-state', text: 'Produk nggak ketemu. Coba keyword lain atau chat admin.' }));
    products.forEach((product) => grid.append(productCard(product)));
  }

  function productCard(product) {
    const card = el('article', { class: 'product-card' });
    const media = el('div', { class: 'product-media' });
    media.append(el('img', { src: imageSrc(product), alt: product.name, loading: 'lazy', width: 420, height: 315 }));
    const body = el('div', { class: 'product-body' });
    const title = div('product-title', el('h3', { text: product.name }), el('span', { class: 'pill', text: statusText(product.status) }));
    const notes = el('ul', { class: 'notes' });
    (product.features || []).slice(0, 4).forEach((item) => notes.append(el('li', { text: item })));
    body.append(title, el('p', { text: product.description || 'Detail produk bisa ditanyakan ke admin resmi.' }), el('div', { class: 'price', text: product.priceLabel || formatRupiah(product.price) }), notes, div('row-actions', button('Detail', 'btn ghost', () => openProductModal(product)), button('Order', 'btn primary', () => openOrderModal(product))));
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
      div('row-actions', button('Order sekarang', 'btn primary', () => openOrderModal(product)), button('Tutup', 'btn ghost', closeModal))
    );
    summary.append(info);
    card.append(summary);
    openModal(card);
  }

  function openOrderModal(product) {
    const message = buildOrderMessage(product);
    const card = modalCard('Pilih kontak order');
    const summary = el('div', { class: 'order-summary' });
    summary.append(el('img', { src: imageSrc(product), alt: product.name, loading: 'lazy' }));
    const info = el('div');
    info.append(
      el('div', { class: 'eyebrow', text: 'ORDER MANUAL' }),
      el('h2', { text: product.name }),
      el('p', { text: `${product.category || 'Produk Digital'} · ${statusText(product.status)}` }),
      el('div', { class: 'price', text: product.priceLabel || formatRupiah(product.price) }),
      el('p', { text: 'Pilih WhatsApp atau Telegram. Format order otomatis disiapkan biar admin langsung paham.' })
    );
    const copy = el('div', { class: 'copy-box', text: message });
    const actions = div('row-actions',
      button('Chat via WhatsApp', 'btn primary', () => contactOrder(product, 'whatsapp')),
      button('Chat via Telegram', 'btn cyan', () => contactOrder(product, 'telegram')),
      button('Salin format', 'btn ghost', async () => { await navigator.clipboard?.writeText(message); notify('Format order disalin.'); })
    );
    info.append(copy, actions);
    summary.append(info);
    card.append(summary);
    openModal(card);
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
    } catch (error) {
      notify(error.message || 'Kontak gagal dibuka.');
    }
  }

  function renderAdminLogin(me = {}) {
    const wrap = el('section', { class: 'section panel' });
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
      ['Storage', env.storageBucket || 'product-images']
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
      el('h2', { text: 'Kelola produk XLIMSTORE' }),
      el('p', { text: 'Tambah produk, edit detail, upload gambar ke Supabase Storage, dan pantau konfigurasi.' }),
      div('row-actions', button('Reload data', 'btn ghost', () => renderAdmin()), button('Logout', 'btn danger', adminLogout))
    );
    const env = me.env || {};
    const status = el('div', { class: 'status-grid' });
    [
      ['Supabase DB', env.supabaseUrl && env.supabaseServiceRoleKey ? 'Ready' : 'Belum lengkap'],
      ['Storage bucket', env.storageBucket || 'product-images'],
      ['Login/payment lama', 'Dihapus'],
      ['Order', 'WhatsApp + Telegram'],
      ['Admin security', env.adminApiHashSecret ? 'Session + CSRF + nonce' : 'Cek ENV'],
      ['WhatsApp', me.config?.whatsappNumber || 'Belum set']
    ].forEach(([a,b]) => status.append(statusCard(a,b)));
    head.append(status);

    const grid = el('div', { class: 'admin-grid' });
    const formBox = el('div', { class: 'admin-box' });
    formBox.append(el('h3', { text: 'Form produk' }), productForm());
    const listBox = el('div', { class: 'admin-box' });
    listBox.append(el('h3', { text: 'Daftar produk' }), el('div', { class: 'empty-state', text: 'Memuat produk admin...' }));
    grid.append(formBox, listBox);
    wrap.append(head, grid);
    app.append(wrap);
    await refreshAdminProducts(listBox);
  }

  function productForm(product = null) {
    state.editingProduct = product;
    const form = el('form', { id: 'productForm' });
    const name = inputField('Nama produk', 'name', 'text', 'Akun FF Sultan');
    const category = inputField('Kategori', 'category', 'text', 'Akun FF');
    const price = inputField('Harga angka', 'price', 'number', '15000');
    const priceLabel = inputField('Harga display', 'price_label', 'text', 'Rp 15.000 / Per bulan: Rp 10.000');
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
      const table = el('div', { class: 'table-wrap' });
      const t = el('table');
      const thead = el('thead');
      const hrow = el('tr');
      ['Gambar', 'Produk', 'Harga', 'Status', 'Aksi'].forEach((h) => hrow.append(el('th', { text: h })));
      thead.append(hrow);
      const tbody = el('tbody');
      products.forEach((p) => {
        const tr = el('tr');
        tr.append(
          el('td', {}, el('img', { class: 'thumb', src: imageSrc(p), alt: p.name, loading: 'lazy' })),
          el('td', {}, el('strong', { text: p.name }), el('p', { text: `${p.category || '-'} · ${p.slug || p.id}` })),
          el('td', { text: p.priceLabel || formatRupiah(p.price) }),
          el('td', { text: `${statusText(p.status)}${p.isActive ? '' : ' · nonaktif'}` }),
          el('td', {}, div('row-actions', button('Edit', 'btn small ghost', () => replaceProductForm(p)), button('Hapus', 'btn small danger', () => deleteProduct(p))))
        );
        tbody.append(tr);
      });
      t.append(thead, tbody);
      table.append(t);
      container.replaceChildren(el('h3', { text: 'Daftar produk' }), products.length ? table : el('div', { class: 'empty-state', text: 'Belum ada produk. Tambah dari form kiri.' }));
    } catch (error) {
      container.replaceChildren(el('h3', { text: 'Daftar produk' }), el('div', { class: 'empty-state', text: error.message }));
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

  async function adminLogout() {
    try { await adminFetch('/api/admin/logout', { method: 'POST', skipNonce: true }); } catch (_) {}
    sessionStorage.removeItem('xlim_admin_csrf');
    state.csrfToken = '';
    notify('Logout berhasil.');
    await renderAdmin();
  }

  async function adminMe() {
    return api('/api/admin/me', { silent: true });
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

  function cryptoNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function openModal(content) {
    modal.replaceChildren(content);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modal.replaceChildren();
  }
  function modalCard(title) {
    const card = el('section', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true' });
    const top = el('div', { class: 'modal-top' });
    top.append(el('h3', { text: title }), el('button', { class: 'btn small ghost', type: 'button', text: 'Tutup', 'data-close-modal': 'true' }));
    card.append(top);
    return card;
  }
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 3100);
  }
  function showError(message) {
    app.replaceChildren(sectionPanel('Lagi error bentar', message || 'Coba reload halaman.'));
  }
  function sectionPanel(title, text) {
    const section = el('section', { class: 'section panel' });
    section.append(el('div', { class: 'eyebrow', text: 'XLIMSTORE' }), el('h2', { text: title }), el('p', { text }));
    return section;
  }
  function statusCard(label, value) {
    const card = el('div', { class: 'status-card' });
    card.append(el('b', { text: label }), el('span', { text: String(value) }));
    return card;
  }
  function step(n, title, text) {
    const item = el('div', { class: 'step' });
    item.append(el('b', { text: n }), el('h3', { text: title }), el('p', { text }));
    return item;
  }
  function miniProduct(src, title, price) {
    const item = el('div', { class: 'mini-product' });
    item.append(el('img', { src, alt: title, loading: 'lazy', width: 76, height: 66 }), div('', el('strong', { text: title }), el('p', { text: price })));
    return item;
  }
  function faqItem(q, a) {
    const d = el('details');
    d.append(el('summary', { text: q }), el('p', { text: a }));
    return d;
  }
  function reviewCard(item) {
    const card = el('article', { class: 'review' });
    const avatar = el('div', { class: 'avatar', text: initials(item.name || 'XL') });
    const body = el('div');
    body.append(el('strong', { text: item.name || 'Pembeli XLIM' }), el('p', { text: `${stars(item.rating)} · ${formatDate(item.created_at)}` }), el('p', { text: item.comment || '' }));
    card.append(avatar, body);
    return card;
  }
  function inputField(labelText, name, type, placeholder) {
    const wrap = el('div', { class: 'field' });
    const id = `field-${name}-${Math.random().toString(16).slice(2)}`;
    const input = el('input', { id, name, type, placeholder });
    wrap.append(el('label', { for: id, text: labelText }), input);
    return { wrap, input };
  }
  function textareaField(labelText, name, placeholder) {
    const wrap = el('div', { class: 'field' });
    const id = `field-${name}-${Math.random().toString(16).slice(2)}`;
    const input = el('textarea', { id, name, placeholder });
    wrap.append(el('label', { for: id, text: labelText }), input);
    return { wrap, input };
  }
  function selectField(labelText, name) {
    const wrap = el('div', { class: 'field' });
    const id = `field-${name}-${Math.random().toString(16).slice(2)}`;
    const input = el('select', { id, name });
    wrap.append(el('label', { for: id, text: labelText }), input);
    return { wrap, input };
  }
  function option(value, label) { return el('option', { value, text: label }); }
  function button(text, className, onClick) {
    const btn = el('button', { type: 'button', class: className, text });
    btn.addEventListener('click', onClick);
    return btn;
  }
  function buttonLink(href, text, className) { return el('a', { href, class: className, text, 'data-link': 'true' }); }
  function externalButton(text, href, className) { return el('a', { href, class: className, text, target: '_blank', rel: 'noopener noreferrer' }); }
  function div(className, ...children) {
    const d = el('div', { class: className });
    d.append(...children.filter(Boolean));
    return d;
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else node.setAttribute(key, value);
    });
    if (children.length) node.append(...children.filter(Boolean));
    return node;
  }
  function imageSrc(product) { return product.imageUrl || product.image || '/assets/img/xlimstore-profile.webp'; }
  function statusText(status) {
    const map = { ready: 'Ready', soldout: 'Sold out', preorder: 'Preorder', inactive: 'Nonaktif' };
    return map[String(status || 'ready').toLowerCase()] || 'Ready';
  }
  function formatRupiah(amount) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(amount || 0)); }
  function stars(n) { return '★★★★★'.slice(0, Number(n || 0)) + '☆☆☆☆☆'.slice(0, Math.max(0, 5 - Number(n || 0))); }
  function initials(name) { return String(name || 'XL').split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(); }
  function formatDate(date) { try { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(date)); } catch (_) { return ''; } }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function trimSlash(value) { return String(value || '').replace(/\/+$/, ''); }
  function telegramUrl() { return `https://t.me/${state.config.telegramUsername || 'xlimstor'}`; }
  function whatsappUrl(message) {
    const number = digits(state.config.whatsappNumber || CFG.WHATSAPP_NUMBER || '');
    if (!number) return '#';
    return `https://wa.me/${number}?text=${encodeURIComponent(message || 'Halo admin XLIMSTORE, saya mau tanya produk.')}`;
  }
  function openContact(method) {
    if (method === 'telegram') return window.open(telegramUrl(), '_blank', 'noopener,noreferrer');
    const url = whatsappUrl('Halo admin XLIMSTORE, saya mau tanya produk.');
    if (url === '#') return notify('Nomor WhatsApp belum diset di Vercel ENV.');
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function buildOrderMessage(product) {
    return [
      'Halo admin XLIMSTORE, saya mau order:',
      `Produk: ${product.name}`,
      `Harga: ${product.priceLabel || formatRupiah(product.price)}`,
      `Kategori: ${product.category || '-'}`,
      `Link/ID Produk: ${product.slug || product.id}`,
      'Catatan: '
    ].join('\n');
  }
  function setMeta(title, description) {
    document.title = title;
    setTag('meta[name="description"]', 'content', description);
    setTag('meta[property="og:title"]', 'content', title);
    setTag('meta[property="og:description"]', 'content', description);
    setTag('meta[property="og:url"]', 'content', SITE_URL + state.route);
    setTag('link[rel="canonical"]', 'href', SITE_URL + state.route);
  }
  function setTag(selector, attr, value) {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attr, value);
  }
})();
