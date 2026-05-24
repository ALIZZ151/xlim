(function () {
  const X = window.Xlim;
  const state = { products: [], filtered: [], activeCategory: 'all', query: '', sort: 'newest', selected: null };
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    bindUI();
    X.setSocialLinks();
    renderSkeleton();
    loadProducts();
    hydrateHash();
  }

  function cacheEls() {
    Object.assign(els, {
      navToggle: document.getElementById('navToggle'),
      navLinks: document.getElementById('navLinks'),
      productGrid: document.getElementById('productGrid'),
      categoryGrid: document.getElementById('categoryGrid'),
      categorySelect: document.getElementById('categorySelect'),
      filterChips: document.getElementById('filterChips'),
      searchInput: document.getElementById('searchInput'),
      sortSelect: document.getElementById('sortSelect'),
      catalogMeta: document.getElementById('catalogMeta'),
      emptyState: document.getElementById('emptyState'),
      errorState: document.getElementById('errorState'),
      reloadProducts: document.getElementById('reloadProducts'),
      retryProducts: document.getElementById('retryProducts'),
      productModal: document.getElementById('productModal'),
      modalImage: document.getElementById('modalImage'),
      modalCategory: document.getElementById('modalCategory'),
      modalStatus: document.getElementById('modalStatus'),
      modalTitle: document.getElementById('modalTitle'),
      modalCaption: document.getElementById('modalCaption'),
      modalPrice: document.getElementById('modalPrice'),
      modalDescription: document.getElementById('modalDescription'),
      relatedProducts: document.getElementById('relatedProducts'),
      openCheckout: document.getElementById('openCheckout'),
      checkoutDrawer: document.getElementById('checkoutDrawer'),
      closeCheckout: document.getElementById('closeCheckout'),
      checkoutSummary: document.getElementById('checkoutSummary'),
      buyerNote: document.getElementById('buyerNote'),
      whatsappOrder: document.getElementById('whatsappOrder'),
      heroProductName: document.getElementById('heroProductName'),
      heroProductCaption: document.getElementById('heroProductCaption'),
      heroProductPrice: document.getElementById('heroProductPrice'),
      heroProductStatus: document.getElementById('heroProductStatus')
    });
  }

  function bindUI() {
    els.navToggle?.addEventListener('click', () => {
      const isOpen = els.navLinks.classList.toggle('open');
      els.navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    els.navLinks?.addEventListener('click', (e) => {
      if (e.target.closest('a')) els.navLinks.classList.remove('open');
    });
    els.searchInput?.addEventListener('input', debounce((e) => {
      state.query = e.target.value;
      X.track('search_used', { query: state.query });
      applyFilters();
    }, 180));
    els.categorySelect?.addEventListener('change', (e) => setCategory(e.target.value));
    els.sortSelect?.addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });
    els.reloadProducts?.addEventListener('click', loadProducts);
    els.retryProducts?.addEventListener('click', loadProducts);
    document.querySelectorAll('[data-close-modal]').forEach((btn) => btn.addEventListener('click', closeModal));
    els.productModal?.addEventListener('click', (e) => { if (e.target === els.productModal) closeModal(); });
    els.openCheckout?.addEventListener('click', () => openCheckout(state.selected));
    els.closeCheckout?.addEventListener('click', closeCheckout);
    els.buyerNote?.addEventListener('input', () => updateWhatsappLink());
    els.whatsappOrder?.addEventListener('click', () => {
      if (state.selected) X.track('whatsapp_order_click', { product_id: state.selected.id, product_name: state.selected.name });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closeCheckout(); }
    });
    window.addEventListener('hashchange', hydrateHash);
  }

  async function loadProducts() {
    renderSkeleton();
    els.errorState.classList.add('hidden');
    els.emptyState.classList.add('hidden');
    try {
      const payload = await X.apiFetch('/api/products');
      const products = X.normalizePayload(payload) || [];
      state.products = Array.isArray(products) ? products.map(normalizeProduct) : [];
      buildCategories();
      applyFilters();
      setHeroProduct();
      if (!state.products.length) X.toast('Katalog masih kosong', 'Tambahkan produk dari admin dashboard.');
    } catch (err) {
      els.productGrid.innerHTML = '';
      els.catalogMeta.textContent = 'Katalog gagal dimuat.';
      els.errorState.classList.remove('hidden');
      X.toast('Katalog lagi ngambek', err.message || 'Coba reload bentar.');
    }
  }

  function normalizeProduct(product) {
    return {
      id: X.safeText(product.id),
      slug: X.productSlug(product),
      name: X.safeText(product.name || product.type || 'Produk digital'),
      type: X.safeText(product.type || product.category || 'Digital'),
      category: X.safeText(product.category || 'lainnya').toLowerCase(),
      caption: X.safeText(product.caption || 'Stok ready, tinggal gas.'),
      description: X.safeText(product.description || product.notes || product.caption || 'Detail produk bisa kamu cek langsung lewat admin.'),
      price: product.price || 0,
      status: X.safeText(product.status || 'ready').toLowerCase(),
      image: product.image,
      createdAt: product.createdAt || product.updatedAt || new Date().toISOString()
    };
  }

  function buildCategories() {
    const categories = getCategories();
    els.categorySelect.innerHTML = '<option value="all">Semua kategori</option>';
    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat.name;
      option.textContent = labelCat(cat.name);
      els.categorySelect.appendChild(option);
    });
    els.filterChips.innerHTML = '';
    [{ name: 'all', count: state.products.length }, ...categories].forEach((cat) => {
      const btn = X.createEl('button', 'chip', `${cat.name === 'all' ? 'Semua' : labelCat(cat.name)} (${cat.count})`);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(state.activeCategory === cat.name));
      btn.addEventListener('click', () => setCategory(cat.name));
      els.filterChips.appendChild(btn);
    });
    els.categoryGrid.innerHTML = '';
    categories.slice(0, 6).forEach((cat) => {
      const card = X.createEl('button', 'category-card');
      card.type = 'button';
      card.innerHTML = '';
      card.appendChild(X.createEl('span', '', `${cat.count} produk`));
      card.appendChild(X.createEl('h3', '', labelCat(cat.name)));
      card.appendChild(X.createEl('p', '', getCategoryCopy(cat.name)));
      card.addEventListener('click', () => {
        setCategory(cat.name);
        document.getElementById('produk')?.scrollIntoView({ behavior: 'smooth' });
      });
      els.categoryGrid.appendChild(card);
    });
  }

  function getCategories() {
    const map = new Map();
    state.products.forEach((p) => map.set(p.category, (map.get(p.category) || 0) + 1));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }

  function setCategory(category) {
    state.activeCategory = category || 'all';
    if (els.categorySelect.value !== state.activeCategory) els.categorySelect.value = state.activeCategory;
    X.track('category_filter_click', { category: state.activeCategory });
    applyFilters();
  }

  function applyFilters() {
    const q = state.query.toLowerCase().trim();
    let list = [...state.products];
    if (state.activeCategory !== 'all') list = list.filter((p) => p.category === state.activeCategory);
    if (q) list = list.filter((p) => `${p.name} ${p.type} ${p.category} ${p.caption} ${p.description}`.toLowerCase().includes(q));
    if (state.sort === 'price-low') list.sort((a, b) => X.priceNumber(a.price) - X.priceNumber(b.price));
    else if (state.sort === 'price-high') list.sort((a, b) => X.priceNumber(b.price) - X.priceNumber(a.price));
    else if (state.sort === 'ready') list.sort((a, b) => Number(b.status === 'ready') - Number(a.status === 'ready') || newestSort(a, b));
    else list.sort(newestSort);
    state.filtered = list;
    renderProducts();
    buildCategories();
  }

  function newestSort(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }

  function renderSkeleton() {
    els.catalogMeta.textContent = 'Lagi nyiapin katalog...';
    els.productGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) els.productGrid.appendChild(X.createEl('div', 'skeleton'));
  }

  function renderProducts() {
    els.errorState.classList.add('hidden');
    els.productGrid.innerHTML = '';
    els.catalogMeta.textContent = `${state.filtered.length} produk ketemu${state.activeCategory !== 'all' ? ` di ${labelCat(state.activeCategory)}` : ''}.`;
    els.emptyState.classList.toggle('hidden', state.filtered.length > 0);
    if (!state.filtered.length) return;
    state.filtered.forEach((product) => els.productGrid.appendChild(productCard(product)));
  }

  function productCard(product) {
    const card = X.createEl('article', 'product-card');
    const imageWrap = X.createEl('div', 'product-image-wrap');
    const img = document.createElement('img');
    img.className = 'product-image';
    img.src = X.imageUrl(product.image);
    img.alt = `Gambar ${product.name}`;
    img.loading = 'lazy';
    img.onerror = () => { img.src = X.config.fallbackImage; };
    const badge = X.createEl('span', `product-badge ${product.status}`, statusLabel(product.status));
    imageWrap.append(img, badge);

    const body = X.createEl('div', 'product-body');
    const tags = X.createEl('div', 'product-tags');
    tags.appendChild(X.createEl('span', '', labelCat(product.category)));
    tags.appendChild(X.createEl('span', '', product.type));
    const title = X.createEl('h3', 'product-title', product.name);
    const caption = X.createEl('p', 'product-caption', product.caption);
    const price = X.createEl('strong', 'product-price', X.formatPrice(product.price));
    const actions = X.createEl('div', 'card-actions');
    const detail = X.createEl('button', 'btn btn-ghost btn-small', 'Cek detail');
    detail.type = 'button';
    detail.addEventListener('click', () => openModal(product));
    const order = X.createEl('button', 'btn btn-primary btn-small', product.status === 'ready' ? 'Ambil sekarang' : 'Pantau restock');
    order.type = 'button';
    order.addEventListener('click', () => openCheckout(product));
    actions.append(detail, order);
    body.append(tags, title, caption, price, actions);
    card.append(imageWrap, body);
    return card;
  }

  function openModal(product) {
    state.selected = product;
    X.track('product_view', { product_id: product.id, product_name: product.name, category: product.category });
    history.replaceState(null, '', `#produk/${product.slug}`);
    els.modalImage.src = X.imageUrl(product.image);
    els.modalImage.alt = `Gambar ${product.name}`;
    els.modalCategory.textContent = labelCat(product.category);
    els.modalStatus.textContent = statusLabel(product.status);
    els.modalTitle.textContent = product.name;
    els.modalCaption.textContent = product.caption;
    els.modalPrice.textContent = X.formatPrice(product.price);
    els.modalDescription.textContent = product.description || 'Detail produk bisa ditanyakan langsung ke admin.';
    renderRelated(product);
    els.productModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    els.openCheckout.focus();
  }

  function closeModal() {
    if (!els.productModal.classList.contains('hidden')) {
      els.productModal.classList.add('hidden');
      document.body.style.overflow = '';
      if (location.hash.startsWith('#produk/')) history.replaceState(null, '', '#produk');
    }
  }

  function renderRelated(product) {
    els.relatedProducts.innerHTML = '';
    state.products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3).forEach((p) => {
      const item = X.createEl('button', 'related-item');
      item.type = 'button';
      const left = X.createEl('div');
      left.appendChild(X.createEl('strong', '', p.name));
      left.appendChild(X.createEl('small', '', X.formatPrice(p.price)));
      item.appendChild(left);
      item.appendChild(X.createEl('span', '', 'Lihat'));
      item.addEventListener('click', () => openModal(p));
      els.relatedProducts.appendChild(item);
    });
    if (!els.relatedProducts.children.length) els.relatedProducts.textContent = 'Belum ada related product di kategori ini.';
  }

  function openCheckout(product) {
    if (!product) return;
    state.selected = product;
    X.track('checkout_start', { product_id: product.id, product_name: product.name, category: product.category });
    els.checkoutSummary.innerHTML = '';
    [
      ['Produk', product.name], ['Harga', X.formatPrice(product.price)], ['Kategori', labelCat(product.category)], ['Status', statusLabel(product.status)]
    ].forEach(([label, value]) => {
      const row = X.createEl('div');
      row.appendChild(X.createEl('span', '', label));
      row.appendChild(X.createEl('strong', '', value));
      els.checkoutSummary.appendChild(row);
    });
    els.buyerNote.value = '';
    updateWhatsappLink();
    els.checkoutDrawer.classList.remove('hidden');
    els.checkoutDrawer.setAttribute('aria-hidden', 'false');
    els.buyerNote.focus();
  }

  function closeCheckout() {
    els.checkoutDrawer.classList.add('hidden');
    els.checkoutDrawer.setAttribute('aria-hidden', 'true');
  }

  function updateWhatsappLink() {
    if (!state.selected) return;
    els.whatsappOrder.href = X.buildWhatsAppLink(state.selected, els.buyerNote.value);
  }

  function hydrateHash() {
    const hash = decodeURIComponent(location.hash || '');
    const match = hash.match(/^#produk\/(.+)$/);
    if (!match || !state.products.length) return;
    const product = state.products.find((p) => p.slug === match[1] || p.id === match[1]);
    if (product) openModal(product);
  }

  function setHeroProduct() {
    const hot = state.products.find((p) => p.status === 'ready') || state.products[0];
    if (!hot) return;
    els.heroProductName.textContent = hot.name;
    els.heroProductCaption.textContent = hot.caption;
    els.heroProductPrice.textContent = X.formatPrice(hot.price);
    els.heroProductStatus.textContent = statusLabel(hot.status);
  }

  function labelCat(category) {
    const cat = X.safeText(category || 'lainnya');
    return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Lainnya';
  }

  function statusLabel(status) {
    const map = { ready: 'Ready stock', habis: 'Stok habis', restock: 'Pantau restock' };
    return map[status] || labelCat(status || 'ready');
  }

  function getCategoryCopy(category) {
    if (category.includes('game')) return 'Akun game dan item digital yang paling sering diburu.';
    if (category.includes('nokos')) return 'Nomor kosong berbagai region, cek stok sebelum gas.';
    return 'Produk digital lain yang bisa kamu order sat-set.';
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }
})();
