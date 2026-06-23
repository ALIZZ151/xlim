# xlim store Supabase + Vercel

Fitur:
- Website store Ocean Blue Black
- Produk dari Supabase
- Order wajib login Google
- Riwayat order per akun user
- Admin panel modern `/admin/`
- Admin produk/order via Vercel API agar service role key tidak bocor ke browser

## Install lokal
```bash
npm install
cp .env.example .env
npm run dev
```

## Supabase
1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan file `supabase/schema.sql`.
4. Aktifkan Google provider di Authentication > Providers > Google.
5. Isi callback URL Google sesuai URL callback Supabase.

## Vercel Environment Variables
Isi di Project Settings > Environment Variables:

```txt
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_SITE_URL=https://domain-kamu.vercel.app
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ADMIN_USERNAME=XLIM
ADMIN_PASSWORD=xlim store
ADMIN_TOKEN_SECRET=random-panjang-minimal-32-karakter
```

Catatan:
- `VITE_SUPABASE_ANON_KEY` memang terlihat di browser, itu normal untuk frontend Supabase. Keamanan data tetap dari RLS.
- `SUPABASE_SERVICE_ROLE_KEY` jangan pernah dipakai di frontend. Di project ini hanya dipakai di folder `/api`.
- Setelah update env Vercel, redeploy project.
