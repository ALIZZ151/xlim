import { ADMIN_TOKEN_KEY } from './config.js';

const state = {
  token: localStorage.getItem(ADMIN_TOKEN_KEY) || '',
  products: [],
  orders: [],
  editingId: null
};

function qs(selector) { return document.querySelector(selector); }
function qsa(selector) { return [...document.querySelectorAll(selector)]; }
function rupiahDate(date) { return date ? new Date(date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'; }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` }; }

async function apiFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Request gagal');
  return data;
}

function showApp() {
  qs('#loginSection')?.classList.add('hidden');
  qs('#dashboardSection')?.classList.remove('hidden');
  loadDashboard();
}

function showLogin() {
  qs('#dashboardSection')?.classList.add('hidden');
  qs('#loginSection')?.classList.remove('hidden');
}

async function login(event) {
  event.preventDefault();
  const alert = qs('#loginAlert');
  alert?.classList.remove('show');
  const username = qs('#adminUsername')?.value.trim();
  const password = qs('#adminPassword')?.value;
  const button = qs('#loginButton');
  button.disabled = true;
  button.textContent = 'LOADING...';

  try {
    const response = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login gagal');
    state.token = data.token;
    localStorage.setItem(ADMIN_TOKEN_KEY, state.token);
    showApp();
  } catch (error) {
    if (alert) {
      alert.textContent = error.message;
      alert.classList.add('show');
    }
  } finally {
    button.disabled = false;
    button.textContent = 'LOGIN';
  }
}

function logout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  state.token = '';
  showLogin();
}

async function loadDashboard() {
  try {
    const [productsRes, ordersRes] = await Promise.all([
      apiFetch('/api/products?admin=1'),
      apiFetch('/api/orders')
    ]);
    state.products = productsRes.products || [];
    state.orders = ordersRes.orders || [];
    renderStats();
    renderProducts();
    renderOrders();
  } catch (error) {
    if (/token|login|unauthorized|expired/i.test(error.message)) logout();
    else Swal.fire({ icon: 'error', title: 'Gagal load admin', text: error.message, background: '#07111f', color: '#fff' });
  }
}

function renderStats() {
  const total = state.products.length;
  const active = state.products.filter((p) => p.is_active).length;
  const inactive = total - active;
  const pendingOrders = state.orders.filter((o) => !['done', 'cancelled'].includes(o.status)).length;
  qs('#statTotalProducts').textContent = total;
  qs('#statActiveProducts').textContent = active;
  qs('#statInactiveProducts').textContent = inactive;
  qs('#statPendingOrders').textContent = pendingOrders;
}

function productBadge(product) {
  return product.is_active ? '<span class="badge active">Aktif</span>' : '<span class="badge inactive">Nonaktif</span>';
}

function renderProducts() {
  const body = qs('#productsTableBody');
  if (!body) return;
  if (!state.products.length) {
    body.innerHTML = '<tr><td colspan="8">Belum ada produk.</td></tr>';
    return;
  }
  body.innerHTML = state.products.map((product) => `
    <tr>
      <td><b>${product.name}</b><br><small style="color:#94a3b8">${product.id}</small></td>
      <td>${product.category || '-'}</td>
      <td><span style="font-family:JetBrains Mono;color:#38bdf8;font-weight:900">${product.price || '-'}</span></td>
      <td>${product.badge || '-'}</td>
      <td>${product.theme || 'ocean'}</td>
      <td>${product.sort_order ?? 0}</td>
      <td>${productBadge(product)}</td>
      <td>
        <div class="action-cell">
          <button class="icon-btn" data-edit-product="${product.id}" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="icon-btn" data-toggle-product="${product.id}" title="Aktif/Nonaktif"><i class="ri-eye-line"></i></button>
          <button class="icon-btn danger" data-delete-product="${product.id}" title="Hapus"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
  bindProductActions();
}

function bindProductActions() {
  qsa('[data-edit-product]').forEach((btn) => btn.addEventListener('click', () => openProductModal(btn.dataset.editProduct)));
  qsa('[data-toggle-product]').forEach((btn) => btn.addEventListener('click', () => toggleProduct(btn.dataset.toggleProduct)));
  qsa('[data-delete-product]').forEach((btn) => btn.addEventListener('click', () => deleteProduct(btn.dataset.deleteProduct)));
}

function openProductModal(id = null) {
  state.editingId = id;
  const modal = qs('#productModal');
  const title = qs('#modalTitle');
  const form = qs('#productForm');
  form.reset();

  const product = id ? state.products.find((item) => String(item.id) === String(id)) : null;
  title.textContent = product ? 'Edit Produk' : 'Tambah Produk';

  qs('#productName').value = product?.name || '';
  qs('#productCategory').value = product?.category || '';
  qs('#productPrice').value = product?.price || '';
  qs('#productBadge').value = product?.badge || '';
  qs('#productIcon').value = product?.icon || 'ri-server-fill';
  qs('#productTheme').value = product?.theme || 'ocean';
  qs('#productSort').value = product?.sort_order ?? 1;
  qs('#productDescription').value = product?.description || '';
  qs('#productFeatures').value = Array.isArray(product?.features) ? product.features.join('\n') : (product?.features || '');
  qs('#productPopular').checked = Boolean(product?.is_popular);
  qs('#productActive').checked = product ? Boolean(product.is_active) : true;

  modal.classList.add('show');
}

function closeProductModal() {
  qs('#productModal')?.classList.remove('show');
  state.editingId = null;
}

function productPayload() {
  return {
    name: qs('#productName').value.trim(),
    category: qs('#productCategory').value.trim(),
    price: qs('#productPrice').value.trim(),
    badge: qs('#productBadge').value.trim(),
    icon: qs('#productIcon').value.trim() || 'ri-server-fill',
    theme: qs('#productTheme').value,
    sort_order: Number(qs('#productSort').value || 0),
    description: qs('#productDescription').value.trim(),
    features: qs('#productFeatures').value.split('\n').map((item) => item.trim()).filter(Boolean),
    is_popular: qs('#productPopular').checked,
    is_active: qs('#productActive').checked
  };
}

async function saveProduct(event) {
  event.preventDefault();
  const payload = productPayload();
  if (!payload.name || !payload.price) {
    Swal.fire({ icon: 'warning', title: 'Nama dan harga wajib diisi', background: '#07111f', color: '#fff' });
    return;
  }
  try {
    if (state.editingId) {
      await apiFetch(`/api/products?id=${encodeURIComponent(state.editingId)}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    }
    closeProductModal();
    await loadDashboard();
    Swal.fire({ icon: 'success', title: 'Produk tersimpan', timer: 1000, showConfirmButton: false, background: '#07111f', color: '#fff' });
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Gagal simpan', text: error.message, background: '#07111f', color: '#fff' });
  }
}

async function toggleProduct(id) {
  const product = state.products.find((item) => String(item.id) === String(id));
  if (!product) return;
  try {
    await apiFetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ is_active: !product.is_active }) });
    await loadDashboard();
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Gagal update', text: error.message, background: '#07111f', color: '#fff' });
  }
}

async function deleteProduct(id) {
  const result = await Swal.fire({
    title: 'Hapus produk?',
    text: 'Data produk akan hilang permanen dari database.',
    icon: 'warning',
    background: '#07111f',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444'
  });
  if (!result.isConfirmed) return;
  try {
    await apiFetch(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Gagal hapus', text: error.message, background: '#07111f', color: '#fff' });
  }
}

function orderBadge(status) {
  const cls = ['done', 'active'].includes(status) ? 'done' : status === 'cancelled' ? 'inactive' : 'pending';
  return `<span class="badge ${cls}">${status}</span>`;
}

function renderOrders() {
  const box = qs('#ordersList');
  if (!box) return;
  if (!state.orders.length) {
    box.innerHTML = '<div class="admin-card">Belum ada order.</div>';
    return;
  }
  box.innerHTML = state.orders.map((order) => `
    <article class="admin-card order-card">
      <div>
        <h4>${order.product_name}</h4>
        <div class="order-meta">
          <span>ID: ${order.id}</span>
          <span>Email: ${order.user_email || order.profiles?.email || '-'}</span>
          <span>Harga: ${order.price}</span>
          <span>${rupiahDate(order.created_at)}</span>
        </div>
        ${order.admin_note ? `<div class="admin-note"><b>Catatan:</b> ${order.admin_note}</div>` : ''}
      </div>
      <div class="order-controls">
        ${orderBadge(order.status)}
        <select data-order-status="${order.id}">
          ${['pending','waiting_payment','processing','active','done','cancelled'].map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <button class="icon-btn" data-order-note="${order.id}" title="Catatan"><i class="ri-sticky-note-line"></i></button>
      </div>
    </article>
  `).join('');
  qsa('[data-order-status]').forEach((select) => select.addEventListener('change', () => updateOrder(select.dataset.orderStatus, { status: select.value })));
  qsa('[data-order-note]').forEach((btn) => btn.addEventListener('click', () => editOrderNote(btn.dataset.orderNote)));
}

async function editOrderNote(id) {
  const order = state.orders.find((item) => String(item.id) === String(id));
  const result = await Swal.fire({
    title: 'Catatan Admin',
    input: 'textarea',
    inputValue: order?.admin_note || '',
    inputPlaceholder: 'Contoh: panel sudah aktif, data login dikirim via WhatsApp',
    background: '#07111f',
    color: '#fff',
    showCancelButton: true,
    confirmButtonText: 'Simpan',
    confirmButtonColor: '#0ea5e9'
  });
  if (result.isConfirmed) updateOrder(id, { admin_note: result.value || '' });
}

async function updateOrder(id, payload) {
  try {
    await apiFetch(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    await loadDashboard();
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Gagal update order', text: error.message, background: '#07111f', color: '#fff' });
  }
}

function showTab(tab) {
  qsa('[data-panel-tab]').forEach((section) => section.classList.add('hidden'));
  qs(`[data-panel-tab="${tab}"]`)?.classList.remove('hidden');
  qsa('[data-side-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.sideTab === tab));
}

document.addEventListener('DOMContentLoaded', () => {
  qs('#loginForm')?.addEventListener('submit', login);
  qs('#logoutAdmin')?.addEventListener('click', logout);
  qs('#addProductBtn')?.addEventListener('click', () => openProductModal());
  qs('#addProductBtn2')?.addEventListener('click', () => openProductModal());
  qs('#closeProductModal')?.addEventListener('click', closeProductModal);
  qs('#cancelProductModal')?.addEventListener('click', closeProductModal);
  qs('#productForm')?.addEventListener('submit', saveProduct);
  qs('#refreshAdmin')?.addEventListener('click', loadDashboard);
  qsa('[data-side-tab]').forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.sideTab)));
  if (state.token) showApp(); else showLogin();
});
