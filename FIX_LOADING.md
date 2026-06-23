# Fix Loading Stuck 0%

Jika website berhenti di loading 0%, penyebab paling sering:

1. Vercel tidak menjalankan build Vite dan men-serve source mentah.
2. Environment variable Supabase belum diisi.
3. CDN JavaScript gagal load.

Patch ini menambahkan:

- fallback preloader, jadi loader otomatis hilang maksimal 3.5 detik;
- `/api/public-config` untuk membaca env dari Vercel;
- Supabase browser SDK via CDN;
- fallback client supaya website tetap tampil walau Supabase belum diset.

Tetap isi Vercel Environment Variables:

```txt
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key_kamu
VITE_SITE_URL=https://domain-kamu
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_kamu
ADMIN_USERNAME=XLIM
ADMIN_PASSWORD=xlim store
ADMIN_TOKEN_SECRET=random_panjang_minimal_32_karakter
```

Vercel Build Settings yang aman:

```txt
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
```

Setelah env diganti, Redeploy.
