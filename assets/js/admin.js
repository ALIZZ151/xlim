(function () {
  const X = window.Xlim;
  const state = { csrfToken: '', products: [], editingId: '', search: '' };
  const els = {};
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheEls();
    bindUI();
    checkSession();
  }

  function cacheEls() {
    Object.assign(els, {
      loginView: document.getElementById('loginView'), dashboardView: document.getElementById('dashboardView'), loginForm: document.getElementById('loginForm'), adminPassword: document.getElementById('adminPassword'), logoutBtn: document.getElementById('logoutBtn'), refreshAdmin: document.getElementById('refreshAdmin'), refreshAudit: document.getElementById('refreshAudit'), newProductBtn: document.getElementById('newProductBtn'), adminSearch: document.getElementById('adminSearch'), rows: document.getElementById('adminProductRows'), form: document.getElementById('productForm'), resetForm: document.getElementById('resetForm'), image: document.getElementById('image'), imagePreview: document.getElementById('imagePreview'), formTitle: document.getElementById('formTitle'), saveProduct: document.getElementById('saveProduct'), auditList: document.getElementById('auditList'), statTotal: document.getElementById('statTotal'), statReady: document.getElementById('statReady'), statEmpty: document.getElementById('statEmpty'), statCategories: document.getElementById('statCategories')
    });
  }

  function bindUI() {
    els.loginForm.addEventListener('submit', login);
    els.logoutBtn.addEventListener('click', logout);
    els.refreshAdmin.addEventListener('click', loadProducts);
    els.refreshAudit.addEventListener('click', loadAudit);
    els.newProductBtn.addEventListener('click', resetForm);
    els.resetForm.addEventListener('click', resetForm);
    els.adminSearch.addEventListener('input', () => { state.search = els.adminSearch.value.toLowerCase(); renderProducts(); });
    els.form.addEventListener('submit', saveProduct);
    els.image.addEventListener('change', previewImage);
  }

  async function checkSession() {
    try {
      const payload = await X.apiFetch('/api/admin/check');
      state.csrfToken = payload.csrfToken || payload.data?.csrfToken || '';
      showDashboard();
      await Promise.all([loadProducts(), loadAudit()]);
    } catch {
      showLogin();
    }
  }

  async function login(e) {
    e.preventDefault();
    const password = els.adminPassword.value;
    try {
      const payload = await X.apiFetch('/api/admin/login', { method: 'POST', body: { password } });
      state.csrfToken = payload.csrfToken || payload.data?.csrfToken || '';
      els.adminPassword.value = '';
      X.toast('Login aman', 'Dashboard siap dipakai.');
      showDashboard();
      await Promise.all([loadProducts(), loadAudit()]);
    } catch (err) {
      X.toast('Token nggak cocok', err.message || 'Coba cek lagi, jangan typo.');
    }
  }

  async function logout() {
    try { await adminFetch('/api/admin/logout', { method: 'POST' }); } catch {}
    state.csrfToken = '';
    showLogin();
    X.toast('Logout berhasil', 'Session admin ditutup.');
  }

  async function loadProducts() {
    try {
      const payload = await X.apiFetch('/api/products');
      const data = X.normalizePayload(payload) || [];
      state.products = Array.isArray(data) ? data : [];
      renderStats();
      renderProducts();
    } catch (err) {
      els.rows.innerHTML = `<tr><td colspan="5">${err.message || 'Gagal load produk'}</td></tr>`;
    }
  }

  async function loadAudit() {
    try {
      const payload = await adminFetch('/api/admin/audit');
      const logs = payload.data || payload.logs || [];
      els.auditList.innerHTML = '';
      if (!logs.length) { els.auditList.textContent = 'Belum ada audit log.'; return; }
      logs.slice(0, 60).forEach((log) => {
        const item = X.createEl('article', 'audit-item');
        item.appendChild(X.createEl('strong', '', log.action || 'event'));
        item.appendChild(X.createEl('span', '', `${new Date(log.time).toLocaleString('id-ID')} • ${log.message || '-'} • IP: ${log.ip || '-'}`));
        els.auditList.appendChild(item);
      });
    } catch (err) {
      els.auditList.textContent = err.message || 'Gagal load audit log.';
    }
  }

  function renderStats() {
    const ready = state.products.filter((p) => p.status === 'ready').length;
    const cats = new Set(state.products.map((p) => p.category)).size;
    els.statTotal.textContent = state.products.length;
    els.statReady.textContent = ready;
    els.statEmpty.textContent = state.products.length - ready;
    els.statCategories.textContent = cats;
  }

  function renderProducts() {
    const query = state.search;
    const list = state.products.filter((p) => `${p.name} ${p.category} ${p.type}`.toLowerCase().includes(query));
    els.rows.innerHTML = '';
    if (!list.length) { els.rows.innerHTML = '<tr><td colspan="5">Belum ada produk yang cocok.</td></tr>'; return; }
    list.forEach((p) => {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      const cell = X.createEl('div', 'product-cell');
      const img = document.createElement('img'); img.src = X.imageUrl(p.image); img.alt = `Gambar ${p.name}`; img.onerror = () => { img.src = X.config.fallbackImage; };
      const text = document.createElement('div'); text.appendChild(X.createEl('strong', '', p.name || p.type)); text.appendChild(X.createEl('small', '', p.caption || '-'));
      cell.append(img, text); nameTd.appendChild(cell);
      tr.appendChild(nameTd);
      tr.appendChild(X.createEl('td', '', p.category || '-'));
      tr.appendChild(X.createEl('td', '', X.formatPrice(p.price)));
      const status = X.createEl('td'); status.appendChild(X.createEl('span', `status-pill ${p.status}`, p.status || 'ready')); tr.appendChild(status);
      const actionTd = X.createEl('td');
      const actions = X.createEl('div', 'action-row');
      const edit = X.createEl('button', 'btn btn-ghost btn-small', 'Edit'); edit.type = 'button'; edit.addEventListener('click', () => fillForm(p));
      const del = X.createEl('button', 'btn btn-ghost btn-small', 'Hapus'); del.type = 'button'; del.addEventListener('click', () => deleteProduct(p));
      actions.append(edit, del); actionTd.appendChild(actions); tr.appendChild(actionTd);
      els.rows.appendChild(tr);
    });
  }

  function fillForm(p) {
    state.editingId = p.id;
    els.formTitle.textContent = 'Edit produk';
    document.getElementById('productId').value = p.id || '';
    ['name','category','type','caption','description','price','status'].forEach((key) => {
      const el = document.getElementById(key);
      if (el) el.value = p[key] || '';
    });
    if (p.image) { els.imagePreview.src = X.imageUrl(p.image); els.imagePreview.classList.remove('hidden'); }
    document.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    state.editingId = '';
    els.form.reset();
    document.getElementById('productId').value = '';
    els.formTitle.textContent = 'Tambah produk';
    els.imagePreview.classList.add('hidden');
    els.imagePreview.removeAttribute('src');
  }

  function previewImage() {
    const file = els.image.files[0];
    if (!file) { els.imagePreview.classList.add('hidden'); return; }
    els.imagePreview.src = URL.createObjectURL(file);
    els.imagePreview.classList.remove('hidden');
  }

  async function saveProduct(e) {
    e.preventDefault();
    const formData = new FormData(els.form);
    const id = state.editingId;
    if (!formData.get('type')) formData.set('type', formData.get('category') || 'Digital');
    try {
      const payload = await adminFetch(id ? `/api/products/${encodeURIComponent(id)}` : '/api/products', { method: id ? 'PUT' : 'POST', body: formData });
      X.toast('Produk berhasil naik ke katalog', payload.message || 'Perubahan tersimpan.');
      resetForm();
      await Promise.all([loadProducts(), loadAudit()]);
    } catch (err) {
      X.toast('Gagal simpan produk', err.message || 'Coba cek input dan upload gambar.');
    }
  }

  async function deleteProduct(product) {
    const ok = confirm(`Hapus produk "${product.name}"? Aksi ini nggak bisa dibatalin.`);
    if (!ok) return;
    try {
      await adminFetch(`/api/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
      X.toast('Produk dihapus', 'Katalog sudah diperbarui.');
      await Promise.all([loadProducts(), loadAudit()]);
    } catch (err) {
      X.toast('Gagal hapus', err.message || 'Coba ulang bentar.');
    }
  }

  function adminFetch(path, options = {}) {
    options.headers = { ...(options.headers || {}), 'X-CSRF-Token': state.csrfToken };
    return X.apiFetch(path, options);
  }

  function showLogin() { els.loginView.classList.remove('hidden'); els.dashboardView.classList.add('hidden'); els.adminPassword.focus(); }
  function showDashboard() { els.loginView.classList.add('hidden'); els.dashboardView.classList.remove('hidden'); }
})();
