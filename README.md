# XLIMSTORE — Pakasir Premium Vercel Ready

Project ini adalah update production-ready dari website existing XLIMSTORE. Arsitektur utama tetap dipertahankan:

- Frontend static SPA di `public/`
- Build output ke `dist/`
- Backend Vercel Serverless Function via single router `api/[...path].js`
- Database dan storage memakai Supabase
- Admin panel existing tetap dipakai dan diperluas dengan order management
- Payment otomatis memakai Pakasir dari backend, bukan dari frontend

## Fitur utama

- Premium dark/glassmorphism storefront.
- Loading/splash screen video MP4 HD di `public/assets/video/loading.mp4`.
- Poster fallback di `public/assets/video/loading-poster.jpg`.
- Katalog produk, search, filter kategori, product detail modal.
- Checkout otomatis: nama pembeli, kontak opsional, catatan opsional.
- Order dibuat ke Supabase dengan status `pending`.
- Payment Pakasir dibuat backend-only.
- Invoice menampilkan total final, fee, metode, payment number/QRIS, expired time, tombol cek status, dan tombol buka Pakasir.
- Webhook Pakasir di `/api/webhooks/pakasir` dengan validasi project + order_id + amount + Transaction Detail API.
- Status polling via `/api/orders/status?order_id=...`.
- Admin bisa melihat order terbaru, detail invoice, dan update status manual bila diperlukan.
- WhatsApp/Telegram tetap ada sebagai support, bukan payment utama.

## Struktur penting

```text
api/[...path].js              Single serverless router Vercel
server/_lib/config.js         Konfigurasi env backend
server/_lib/pakasir.js        Pakasir API client backend-only
server/_lib/supabase.js       Supabase service-role client
server/_lib/auth.js           Admin auth, CSRF, nonce, audit, rate limit
public/index.html             SPA entry + loading video
public/app.js                 UI, checkout, invoice, admin panel
public/styles.css             Premium responsive UI
public/assets/video/          Loading video + poster
supabase/schema.sql           Schema final termasuk orders/payments/webhook logs
supabase/seed.sql             Seed produk existing
vercel.json                   Build/output/rewrites/cache headers
.env.example                  Env Vercel final
```

## Endpoint API

Public:

```text
GET  /api/health
GET  /api/config
GET  /api/products
GET  /api/products/[idOrSlug]
GET  /api/ratings
POST /api/ratings
POST /api/orders/contact
POST /api/orders/create
POST /api/payments/create
GET  /api/orders/status?order_id=XLIM-YYYYMMDD-XXXXXX
POST /api/webhooks/pakasir
POST /api/payments/simulate
POST /api/payments/cancel
```

Admin protected:

```text
POST  /api/admin/login
POST  /api/admin/logout
GET   /api/admin/me
GET   /api/admin/products
POST  /api/admin/products
GET   /api/admin/products/[id]
PATCH /api/admin/products/[id]
DELETE /api/admin/products/[id]
POST  /api/admin/upload
GET   /api/admin/audit
GET   /api/admin/orders
GET   /api/admin/orders/[order_id]
PATCH /api/admin/orders/[order_id]
```

## Setup Supabase

1. Buat project Supabase.
2. Buka **SQL Editor**.
3. Jalankan semua isi:

```sql
supabase/schema.sql
```

4. Jalankan seed produk:

```sql
supabase/seed.sql
```

5. Pastikan bucket `product-images` ada dan public. Schema sudah mencoba membuat bucket otomatis.
6. Ambil:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

> `SUPABASE_SERVICE_ROLE_KEY` hanya untuk Vercel Environment Variables. Jangan pernah taruh di frontend.

## Setup Pakasir

1. Login ke dashboard Pakasir.
2. Buat project untuk website ini.
3. Catat `Slug` dan `API Key` project.
4. Masukkan ke Vercel env:

```env
PAKASIR_PROJECT=slug-project-kamu
PAKASIR_SLUG=slug-project-kamu
PAKASIR_API_KEY=api-key-project-kamu
PAKASIR_DEFAULT_METHOD=qris
PAKASIR_QRIS_ONLY=true
PAKASIR_PAYMENT_BASE_URL=https://app.pakasir.com
PAKASIR_WEBHOOK_ENABLED=true
PAKASIR_FLOW=api
```

5. Set webhook URL di Pakasir:

```text
https://DOMAIN-KAMU/api/webhooks/pakasir
```

### Mode payment

Default:

```env
PAKASIR_FLOW=api
```

Mode ini membuat transaksi lewat API Pakasir dan menampilkan QRIS/VA langsung di invoice website.

Fallback redirect:

```env
PAKASIR_FLOW=redirect
```

Mode ini tetap membuat order internal dan menyiapkan payment URL Pakasir. Cocok kalau ingin user diarahkan ke halaman Pakasir.

## Environment Variables Vercel

Isi di **Vercel Project → Settings → Environment Variables**:

```env
# Pakasir
PAKASIR_PROJECT=
PAKASIR_SLUG=
PAKASIR_API_KEY=
PAKASIR_DEFAULT_METHOD=qris
PAKASIR_QRIS_ONLY=true
PAKASIR_PAYMENT_BASE_URL=https://app.pakasir.com
PAKASIR_WEBHOOK_ENABLED=true
PAKASIR_FLOW=api
PAKASIR_SANDBOX_ENABLED=false
PAKASIR_TIMEOUT_MS=15000

# Site
FRONTEND_ORIGIN=https://domain-kamu.com
NEXT_PUBLIC_SITE_URL=https://domain-kamu.com
WHATSAPP_NUMBER=628xxxxxxxxxx
TELEGRAM_USERNAME=xlimstor

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images

# Admin existing
echo generate dengan: npm run hash:admin -- password-admin-kamu
ADMIN_KEY=
ADMIN_PASSWORD_HASH=
ADMIN_PASSWORD_SALT=
ADMIN_SESSION_SECRET=
ADMIN_API_HASH_SECRET=

NODE_ENV=production
MAX_UPLOAD_BYTES=3145728
ADMIN_SESSION_TTL_HOURS=12
```

## Generate password admin

```bash
npm install
npm run hash:admin -- password-admin-kamu
```

Masukkan output hash/salt/secret ke Vercel Environment Variables.

## Deploy GitHub + Vercel

1. Extract ZIP ini.
2. Push folder project ke GitHub.
3. Import repo ke Vercel.
4. Set env Vercel sesuai daftar di atas.
5. Build Command:

```bash
npm run build
```

6. Output Directory:

```text
dist
```

7. Deploy.

## Test lokal

```bash
npm install
npm run check
npm run build
```

Catatan: API Supabase/Pakasir penuh baru bisa dites setelah env asli diisi.

## Cara test order

1. Buka `/produk`.
2. Klik **Beli Sekarang**.
3. Isi nama pembeli.
4. Pilih metode pembayaran.
5. Klik **Buat Invoice**.
6. Pastikan invoice muncul berisi:
   - Invoice ID
   - Nama produk
   - Total final
   - QRIS/payment number
   - Expired time
   - Tombol cek status
   - Tombol buka Pakasir
7. Cek Supabase table `orders` dan `payments`.
8. Setelah pembayaran sukses/webhook masuk, cek status invoice berubah menjadi paid.

## Test webhook Pakasir

Webhook URL:

```text
https://DOMAIN-KAMU/api/webhooks/pakasir
```

Payload yang divalidasi backend:

```json
{
  "amount": 22000,
  "order_id": "XLIM-YYYYMMDD-XXXXXX",
  "project": "slug-project-kamu",
  "status": "completed",
  "payment_method": "qris",
  "completed_at": "2026-06-09T20:00:00+07:00"
}
```

Backend akan:

1. Simpan payload ke `payment_webhook_logs`.
2. Validasi `project`.
3. Validasi `order_id` ada di database.
4. Validasi `amount` cocok dengan order.
5. Validasi `status` harus `completed`.
6. Call Transaction Detail API Pakasir.
7. Jika valid, update `orders.status = paid` dan `payments.status = completed`.

## Payment simulation sandbox

Endpoint:

```text
POST /api/payments/simulate
```

Body:

```json
{ "order_id": "XLIM-YYYYMMDD-XXXXXX" }
```

Akan aktif hanya jika:

```env
NODE_ENV!=production
```

atau:

```env
PAKASIR_SANDBOX_ENABLED=true
```

## Checklist testing

- [ ] `GET /api/health` jalan.
- [ ] Produk tampil di `/produk`.
- [ ] Loading video muncul HD dan fade out.
- [ ] Product card responsive di mobile.
- [ ] Checkout bisa membuat order.
- [ ] Order masuk ke table `orders`.
- [ ] Payment masuk ke table `payments`.
- [ ] Payment Pakasir berhasil dibuat.
- [ ] QRIS/payment info tampil di invoice.
- [ ] Status pending tampil.
- [ ] Tombol cek status berjalan.
- [ ] Webhook Pakasir diterima di `/api/webhooks/pakasir`.
- [ ] Backend memvalidasi ulang via Transaction Detail API.
- [ ] Order berubah menjadi `paid`.
- [ ] Frontend invoice berubah menjadi pembayaran berhasil.
- [ ] Admin bisa melihat order di `/admin`.
- [ ] `PAKASIR_API_KEY` tidak muncul di browser/network response.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak muncul di browser/network response.
- [ ] `npm run check` sukses.
- [ ] `npm run build` sukses.
- [ ] Deploy Vercel sukses.
- [ ] Tidak ada fatal error di console browser.

## Catatan keamanan

- Harga tidak pernah dipercaya dari frontend; backend mengambil harga dari database berdasarkan produk.
- `PAKASIR_API_KEY` hanya dipakai backend.
- `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai backend.
- Webhook tidak langsung dipercaya; wajib cocok `project`, `order_id`, `amount`, dan Transaction Detail API.
- Webhook idempotent: order yang sudah paid tidak diproses ulang.
- Admin endpoint tetap dilindungi session cookie HttpOnly + CSRF + nonce.
- Rate limit dipakai untuk login, rating, contact order, create order, dan status check.
- Upload gambar divalidasi MIME, magic bytes, ukuran, dan random filename.
- Error production tidak mengirim stack trace ke user.
- Audit log menyimpan event penting: `order_created`, `payment_created`, `webhook_received`, `webhook_invalid`, `payment_completed`, `payment_cancelled`, dan event admin existing.
