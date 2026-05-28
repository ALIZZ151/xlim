# XLIMSTORE — Full Vercel + Supabase Final

Project ini sudah dimigrasikan supaya **frontend + backend/API berjalan penuh di Vercel**. Backend VPS lama tidak dipakai lagi. Data dinamis memakai **Supabase Database**, upload gambar produk memakai **Supabase Storage**.

## Isi project

- `public/` — frontend SPA ringan untuk route `/demo`, `/produk`, `/rating`, `/admin`.
- `api/` — Vercel Serverless Functions.
- `supabase/schema.sql` — schema database, RLS, bucket storage, indexes.
- `supabase/seed.sql` — seed produk lama dari `backups/products-before-supabase.json`.
- `backups/products-before-supabase.json` — backup data produk lama sebelum migrasi.
- `.env.example` — daftar environment variable Vercel.

## Fitur yang sudah dihapus

- Google Login dihapus total.
- Pakasir dihapus total.
- Webhook Pakasir tidak ada lagi.
- Tidak ada dependency VPS/backend lama.

Order sekarang manual melalui:

- WhatsApp
- Telegram: `https://t.me/xlimstor`

## Struktur API

- `GET /api/health`
- `GET /api/config`
- `GET /api/products`
- `GET /api/products/[idOrSlug]`
- `GET /api/ratings`
- `POST /api/ratings`
- `POST /api/orders/contact`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/[id]`
- `PATCH /api/admin/products/[id]`
- `DELETE /api/admin/products/[id]`
- `POST /api/admin/upload`
- `GET /api/admin/audit`

## Setup Supabase

1. Buat project Supabase baru.
2. Buka **SQL Editor**.
3. Jalankan isi file:

   ```sql
   supabase/schema.sql
   ```

4. Jalankan seed produk lama:

   ```sql
   supabase/seed.sql
   ```

5. Pastikan bucket Storage bernama `product-images` ada dan public. File `schema.sql` sudah mencoba membuatnya otomatis.
6. Ambil nilai berikut dari Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

> Penting: `SUPABASE_SERVICE_ROLE_KEY` hanya boleh disimpan di Vercel Environment Variables. Jangan pernah taruh di frontend JS.

## Generate password admin hash

Di local terminal:

```bash
npm install
npm run hash:admin -- password-admin-kamu
```

Output-nya akan seperti:

```env
ADMIN_PASSWORD_SALT=...
ADMIN_PASSWORD_HASH=...
ADMIN_SESSION_SECRET=...
ADMIN_API_HASH_SECRET=...
```

Masukkan output tersebut ke Vercel Environment Variables.

## Environment Variables Vercel

Isi di **Vercel Project → Settings → Environment Variables**:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=product-images

ADMIN_KEY=xlim-admin-key-kamu
ADMIN_PASSWORD_HASH=hasil-dari-script
ADMIN_PASSWORD_SALT=hasil-dari-script
ADMIN_SESSION_SECRET=hasil-dari-script
ADMIN_API_HASH_SECRET=hasil-dari-script

FRONTEND_ORIGIN=https://xlim.alizz.my.id
NEXT_PUBLIC_SITE_URL=https://xlim.alizz.my.id
WHATSAPP_NUMBER=6283193075449
TELEGRAM_USERNAME=xlimstor

NODE_ENV=production
MAX_UPLOAD_BYTES=3145728
ADMIN_SESSION_TTL_HOURS=12
```

## Deploy ke Vercel

1. Upload/import folder project ini ke GitHub atau deploy langsung via Vercel CLI.
2. Set env sesuai daftar di atas.
3. Build command:

   ```bash
   npm run build
   ```

4. Output directory:

   ```text
   dist
   ```

5. Deploy.
6. Test:

   ```text
   https://xlim.alizz.my.id/api/health
   https://xlim.alizz.my.id/api/products
   https://xlim.alizz.my.id/demo
   https://xlim.alizz.my.id/produk
   https://xlim.alizz.my.id/rating
   https://xlim.alizz.my.id/admin
   ```

## Cara login admin

Buka manual:

```text
https://xlim.alizz.my.id/admin
```

Masukkan:

- Admin Key: isi dari `ADMIN_KEY`
- Password: password asli yang kamu pakai saat generate hash

Admin tidak muncul di navbar publik, bottom nav, atau footer publik.

## Cara test admin

1. Login ke `/admin`.
2. Pastikan dashboard muncul.
3. Klik tambah produk.
4. Upload gambar JPG/PNG/WebP maksimal 3 MB.
5. Submit produk.
6. Buka `/produk`; produk baru harus tampil.
7. Edit produk.
8. Hapus produk. Delete memakai soft-delete: produk nonaktif dari katalog publik, data tidak langsung dihancurkan.
9. Logout.

## Cara test order WhatsApp/Telegram

1. Buka `/produk`.
2. Klik produk.
3. Klik **Order**.
4. Klik **Chat via WhatsApp**.
5. Pastikan pesan otomatis berisi nama produk, harga, kategori, dan ID/slug produk.
6. Klik **Chat via Telegram**.
7. Format order akan dicopy; paste ke chat Telegram admin.

## Security yang diterapkan

- Secret hanya dari Vercel ENV.
- `.env` masuk `.gitignore`.
- Supabase service role tidak pernah dikirim ke browser.
- Admin login memakai Admin Key + Password Hash/Salt.
- Session admin memakai cookie `HttpOnly`, `Secure` di production, `SameSite=Lax`.
- Admin API wajib CSRF token.
- Mutasi admin memakai timestamp + nonce anti replay.
- Server menghitung HMAC request integrity dengan `ADMIN_API_HASH_SECRET` untuk audit internal tanpa membocorkan secret ke frontend.
- Rate limit login admin, rating, dan order/contact click disimpan di Supabase.
- Upload gambar divalidasi MIME + magic bytes + ukuran + random filename.
- Input produk/rating disanitasi.
- Output frontend memakai `textContent`, bukan render HTML dari data user.
- Admin audit log untuk login, produk, upload, rating, dan order contact.

## Catatan migrasi produk lama

Data lama dibackup di:

```text
backups/products-before-supabase.json
```

Produk lama dimasukkan ke `supabase/seed.sql`. Gambar produk lama tetap tersedia sebagai asset publik di:

```text
public/assets/img/
```

Produk/gambar baru dari admin akan masuk ke Supabase Storage bucket `product-images`.

## QC lokal yang bisa dijalankan

```bash
npm run check
npm run build
```

`npm run check` mengecek syntax JS. Test API Supabase penuh baru bisa dilakukan setelah env Supabase asli diisi di Vercel.


## Catatan Vercel Hobby

Project ini sudah memakai satu serverless router `api/[...path].js` supaya tidak kena limit jumlah Serverless Functions di Vercel Hobby. Semua endpoint tetap sama, misalnya `/api/health`, `/api/products`, `/api/admin/login`, dan lainnya.
