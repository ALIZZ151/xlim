const TOKEN_KEY = 'xlim_admin_session_v3';
const LOGIN_REMEMBER_KEY = 'xlim_admin_remember';

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  view: 'overview',
  products: [],
  orders: [],
  editingProduct: null,
  loading: false
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  if (!value) return 'Chat Admin';
  if (String(value).toLowerCase().includes('rp')) return value;
  return `Rp ${value}`;
}

function normalizeFeatures(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    state.token = '';
    renderLogin('Sesi admin habis. Silakan login lagi.');
    throw new Error('Unauthorized');
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Request gagal.');
  }

  return data;
}

function setToken(token) {
  state.token = token;
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  state.token = '';
  localStorage.removeItem(TOKEN_KEY);
}

async function verifySession() {
  if (!state.token) return false;

  try {
    const data = await apiFetch('/api/admin-verify', {
      method: 'GET'
    });

    return data.success === true;
  } catch {
    clearToken();
    return false;
  }
}

function renderLogin(message = '') {
  document.body.className = 'auth-body';
  document.body.innerHTML = `
    <main class="auth-shell">
      <div class="auth-orb one"></div>
      <div class="auth-orb two"></div>

      <form class="login-card" id="adminLoginForm" autocomplete="off">
        <div class="login-avatar">
          <i class="ri-shield-keyhole-line"></i>
        </div>

        <h1 class="auth-title">XLIM Admin</h1>
        <p class="auth-subtitle">
          Masuk ke sistem owner untuk mengelola produk, order, dan status layanan.
        </p>

        <div class="login-alert ${message ? 'show' : ''}" id="loginAlert">${escapeHtml(message)}</div>

        <input type="text" name="website" tabindex="-1" autocomplete="off" class="admin-honeypot" aria-hidden="true">

        <label class="input-group">
          <i class="ri-user-3-line"></i>
          <input id="adminUsername" name="username" type="text" placeholder="Username admin" autocomplete="username" required>
        </label>

        <label class="input-group">
          <i class="ri-lock-password-line"></i>
          <input id="adminPassword" name="password" type="password" placeholder="Password admin" autocomplete="current-password" required>
        </label>

        <div class="input-row">
          <label>
            <input id="rememberAdmin" type="checkbox">
            Ingat perangkat ini
          </label>
          <span>Protected session</span>
        </div>

        <button class="login-btn" type="submit">
          LOGIN
        </button>
      </form>
    </main>
  `;

  const remember = localStorage.getItem(LOGIN_REMEMBER_KEY) || '';
  if (remember) {
    document.getElementById('adminUsername').value = remember;
    document.getElementById('rememberAdmin').checked = true;
  }

  document.getElementById('adminLoginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const alert = document.getElementById('loginAlert');
  const button = form.querySelector('button[type="submit"]');

  const payload = {
    username: form.username.value.trim(),
    password: form.password.value,
    website: form.website.value
  };

  button.disabled = true;
  button.textContent = 'MEMERIKSA...';
  alert.classList.remove('show');

  try {
    const data = await apiFetch('/api/admin-login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    setToken(data.token);

    if (document.getElementById('rememberAdmin').checked) {
      localStorage.setItem(LOGIN_REMEMBER_KEY, payload.username);
    } else {
      localStorage.removeItem(LOGIN_REMEMBER_KEY);
    }

    await loadAdminData();
    renderDashboard();
  } catch (error) {
    alert.textContent = error.message || 'Login gagal.';
    alert.classList.add('show');
  } finally {
    button.disabled = false;
    button.textContent = 'LOGIN';
  }
}

function logoutAdmin() {
  clearToken();
  renderLogin('Kamu sudah logout dari perangkat ini.');
}

async function loadAdminData() {
  state.loading = true;

  try {
    const [productsData, ordersData] = await Promise.all([
      apiFetch('/api/products?admin=1'),
      apiFetch('/api/orders')
    ]);

    state.products = productsData.products || [];
    state.orders = ordersData.orders || [];
  } finally {
    state.loading = false;
  }
}

function renderDashboard() {
  document.body.className = 'panel-body';
  document.body.innerHTML = `
    <main class="panel-layout">
      <aside class="sidebar">
        <div>
          <div class="sidebar-brand">
            <div class="sidebar-logo">
              <i class="ri-store-3-line"></i>
            </div>
            <div>
              <h1>xlim store</h1>
              <p>Admin System</p>
            </div>
          </div>

          <nav class="side-nav">
            <button class="side-link ${state.view === 'overview' ? 'active' : ''}" data-view="overview">
              <i class="ri-dashboard-3-line"></i>
              Overview
            </button>
            <button class="side-link ${state.view === 'products' ? 'active' : ''}" data-view="products">
              <i class="ri-shopping-bag-3-line"></i>
              Produk
            </button>
            <button class="side-link ${state.view === 'orders' ? 'active' : ''}" data-view="orders">
              <i class="ri-file-list-3-line"></i>
              Order
            </button>
          </nav>
        </div>

        <div class="side-footer">
          <button class="btn-outline-super btn-block" id="refreshAdmin">
            <i class="ri-refresh-line"></i>
            Refresh
          </button>
          <button class="btn-danger btn-block" id="logoutAdmin">
            <i class="ri-logout-box-r-line"></i>
            Logout
          </button>
        </div>
      </aside>

      <section class="panel-main" id="panelMain"></section>
    </main>

    <div class="modal-backdrop" id="productModal">
      <div class="modal-card">
        <div class="modal-head">
          <h3 id="modalTitle">Tambah Produk</h3>
          <button class="icon-btn" type="button" id="closeProductModal">
            <i class="ri-close-line"></i>
          </button>
        </div>

        <form id="productForm">
          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label>Nama Produk</label>
                <input name="name" placeholder="Panel Bot Basic" required>
              </div>

              <div class="field">
                <label>Kategori</label>
                <input name="category" placeholder="Starter / Best Seller" required>
              </div>

              <div class="field">
                <label>Harga</label>
                <input name="price" placeholder="Rp 5.000" required>
              </div>

              <div class="field">
                <label>Badge</label>
                <input name="badge" placeholder="Populer">
              </div>

              <div class="field">
                <label>Icon Remix</label>
                <input name="icon" placeholder="ri-server-fill">
              </div>

              <div class="field">
                <label>Theme</label>
                <select name="theme">
                  <option value="ocean">Ocean</option>
                  <option value="cyan">Cyan</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </div>

              <div class="field">
                <label>Urutan</label>
                <input name="sort_order" type="number" placeholder="1" value="1">
              </div>

              <div class="field">
                <label>Pengaturan</label>
                <label class="switch-label">
                  Jadikan populer
                  <input name="is_popular" type="checkbox">
                </label>
                <label class="switch-label">
                  Produk aktif
                  <input name="is_active" type="checkbox" checked>
                </label>
              </div>

              <div class="field full">
                <label>Deskripsi</label>
                <textarea name="description" placeholder="Deskripsi produk..."></textarea>
              </div>

              <div class="field full">
                <label>Fitur Produk</label>
                <textarea name="features" placeholder="Satu fitur per baris&#10;Setup cepat&#10;Panel siap deploy"></textarea>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-outline-super" type="button" id="cancelProductModal">Batal</button>
            <button class="btn-super" type="submit">Simpan Produk</button>
          </div>
        </form>
      </div>
    </div>
  `;

  bindDashboardEvents();
  renderMain();
}

function bindDashboardEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      renderDashboard();
    });
  });

  document.getElementById('logoutAdmin').addEventListener('click', logoutAdmin);

  document.getElementById('refreshAdmin').addEventListener('click', async () => {
    await loadAdminData();
    renderDashboard();
  });

  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal').addEventListener('click', closeProductModal);
  document.getElementById('productModal').addEventListener('click', (event) => {
    if (event.target.id === 'productModal') closeProductModal();
  });

  document.getElementById('productForm').addEventListener('submit', saveProduct);
}

function renderMain() {
  const main = document.getElementById('panelMain');
  if (!main) return;

  if (state.view === 'products') {
    main.innerHTML = renderProductsView();
    bindProductActions();
    return;
  }

  if (state.view === 'orders') {
    main.innerHTML = renderOrdersView();
    bindOrderActions();
    return;
  }

  main.innerHTML = renderOverviewView();
  bindOverviewActions();
}

function renderHeader(title, desc, actions = '') {
  return `
    <div class="panel-header">
      <div>
        <h2>${title}</h2>
        <p>${desc}</p>
      </div>
      <div class="admin-actions">${actions}</div>
    </div>
  `;
}

function renderOverviewView() {
  const total = state.products.length;
  const active = state.products.filter((item) => item.is_active).length;
  const inactive = total - active;
  const orders = state.orders.filter((item) => !['done', 'cancelled'].includes(item.status)).length;

  return `
    ${renderHeader(
      'Dashboard Owner',
      'Kelola produk, tampilan, dan status order xlim store.',
      `
        <button class="btn-super" id="overviewAddProduct">
          <i class="ri-add-line"></i>
          Tambah Produk
        </button>
        <a class="btn-outline-super" href="/" target="_blank">
          <i class="ri-external-link-line"></i>
          Lihat Website
        </a>
      `
    )}

    <div class="stats-grid">
      <div class="admin-card stat-admin">
        <div>
          <span>Total Produk</span>
          <b>${total}</b>
        </div>
        <i class="ri-shopping-bag-3-line"></i>
      </div>

      <div class="admin-card stat-admin">
        <div>
          <span>Produk Aktif</span>
          <b>${active}</b>
        </div>
        <i class="ri-eye-line"></i>
      </div>

      <div class="admin-card stat-admin">
        <div>
          <span>Nonaktif</span>
          <b>${inactive}</b>
        </div>
        <i class="ri-eye-off-line"></i>
      </div>

      <div class="admin-card stat-admin">
        <div>
          <span>Order Proses</span>
          <b>${orders}</b>
        </div>
        <i class="ri-file-list-3-line"></i>
      </div>
    </div>

    <div class="admin-card">
      <h3 class="system-title">Sistem Aktif</h3>
      <p class="system-desc">
        Admin login memakai session token per perangkat. HP/laptop lain tetap harus login sendiri.
        Akses database berjalan lewat Vercel API memakai service role key di server, bukan di browser.
      </p>
    </div>
  `;
}

function bindOverviewActions() {
  document.getElementById('overviewAddProduct')?.addEventListener('click', () => openProductModal());
}

function renderProductsView() {
  return `
    ${renderHeader(
      'Manajemen Produk',
      'Tambah, edit, hapus, aktif/nonaktif produk.',
      `
        <button class="btn-super" id="addProductBtn">
          <i class="ri-add-line"></i>
          Tambah Produk
        </button>
      `
    )}

    <div class="admin-card table-card">
      <div class="table-head">
        <h3>Daftar Produk</h3>
        <span class="badge active">Supabase</span>
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Badge</th>
              <th>Theme</th>
              <th>Urutan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${state.products.map((item) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml(item.id)}</small>
                </td>
                <td>${escapeHtml(item.category || '-')}</td>
                <td><span class="price-text">${escapeHtml(item.price || '-')}</span></td>
                <td>${escapeHtml(item.badge || '-')}</td>
                <td>${escapeHtml(item.theme || '-')}</td>
                <td>${Number(item.sort_order || 0)}</td>
                <td>
                  <span class="badge ${item.is_active ? 'active' : 'inactive'}">
                    ${item.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  <div class="action-cell">
                    <button class="icon-btn" data-edit="${item.id}" title="Edit">
                      <i class="ri-pencil-line"></i>
                    </button>
                    <button class="icon-btn" data-toggle="${item.id}" title="Aktif/nonaktif">
                      <i class="${item.is_active ? 'ri-eye-off-line' : 'ri-eye-line'}"></i>
                    </button>
                    <button class="icon-btn danger" data-delete="${item.id}" title="Hapus">
                      <i class="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindProductActions() {
  document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());

  document.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = state.products.find((item) => item.id === button.dataset.edit);
      if (product) openProductModal(product);
    });
  });

  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const product = state.products.find((item) => item.id === button.dataset.toggle);
      if (!product) return;

      await apiFetch('/api/products', {
        method: 'PUT',
        body: JSON.stringify({
          id: product.id,
          is_active: !product.is_active
        })
      });

      await loadAdminData();
      renderDashboard();
    });
  });

  document.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ok = confirm('Hapus produk ini permanen?');
      if (!ok) return;

      await apiFetch(`/api/products?id=${encodeURIComponent(button.dataset.delete)}`, {
        method: 'DELETE'
      });

      await loadAdminData();
      renderDashboard();
    });
  });
}

function openProductModal(product = null) {
  state.editingProduct = product;

  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');

  document.getElementById('modalTitle').textContent = product ? 'Edit Produk' : 'Tambah Produk';

  form.reset();

  if (product) {
    form.name.value = product.name || '';
    form.category.value = product.category || '';
    form.price.value = product.price || '';
    form.badge.value = product.badge || '';
    form.icon.value = product.icon || '';
    form.theme.value = product.theme || 'ocean';
    form.sort_order.value = Number(product.sort_order || 1);
    form.is_popular.checked = Boolean(product.is_popular);
    form.is_active.checked = Boolean(product.is_active);
    form.description.value = product.description || '';
    form.features.value = normalizeFeatures(product.features).join('\n');
  } else {
    form.theme.value = 'ocean';
    form.sort_order.value = state.products.length + 1;
    form.is_active.checked = true;
    form.is_popular.checked = false;
  }

  modal.classList.add('show');
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.remove('show');
  state.editingProduct = null;
}

async function saveProduct(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const payload = {
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    price: form.price.value.trim(),
    badge: form.badge.value.trim(),
    icon: form.icon.value.trim() || 'ri-server-fill',
    theme: form.theme.value || 'ocean',
    sort_order: Number(form.sort_order.value || 1),
    is_popular: form.is_popular.checked,
    is_active: form.is_active.checked,
    description: form.description.value.trim(),
    features: normalizeFeatures(form.features.value)
  };

  if (state.editingProduct) {
    payload.id = state.editingProduct.id;
  }

  await apiFetch('/api/products', {
    method: state.editingProduct ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  closeProductModal();
  await loadAdminData();
  renderDashboard();
}

function renderOrdersView() {
  return `
    ${renderHeader('Manajemen Order', 'Lihat dan update status order pelanggan.', '')}

    <div class="orders-grid">
      ${state.orders.length ? state.orders.map((order) => `
        <article class="admin-card order-card">
          <div>
            <h4>${escapeHtml(order.product_name || 'Order')}</h4>
            <div class="order-meta">
              <span><i class="ri-user-line"></i> ${escapeHtml(order.customer_email || order.email || order.user_id || '-')}</span>
              <span><i class="ri-money-dollar-circle-line"></i> ${escapeHtml(order.price || '-')}</span>
              <span><i class="ri-time-line"></i> ${formatDate(order.created_at)}</span>
            </div>
            <small class="order-id">${escapeHtml(order.id)}</small>
          </div>

          <div class="order-controls">
            <span class="badge pending">${escapeHtml(order.payment_status || 'unpaid')}</span>
            <select data-order-status="${order.id}">
              ${['pending', 'waiting_payment', 'processing', 'active', 'done', 'cancelled'].map((status) => `
                <option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>
              `).join('')}
            </select>
          </div>
        </article>
      `).join('') : `
        <div class="admin-card">
          <h3>Belum ada order</h3>
          <p class="system-desc">Order pelanggan akan muncul di sini setelah mereka klik order dari website.</p>
        </div>
      `}
    </div>
  `;
}

function bindOrderActions() {
  document.querySelectorAll('[data-order-status]').forEach((select) => {
    select.addEventListener('change', async () => {
      await apiFetch('/api/orders', {
        method: 'PUT',
        body: JSON.stringify({
          id: select.dataset.orderStatus,
          status: select.value
        })
      });

      await loadAdminData();
      renderDashboard();
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (await verifySession()) {
    await loadAdminData();
    renderDashboard();
  } else {
    renderLogin();
  }
});
