# XLIMSTORE Frontend - FIX BENAR

Build ini dibuat **bulletproof**: CSS dan JavaScript utama sudah di-inline ke `index.html` dan `admin.html`, jadi tampilan tidak akan balik polos walaupun path `/assets/...` di hosting bermasalah.

## Domain yang dipakai

- Storefront: `https://xlim.alizz.my.id`
- Backend/API: `https://admin-xlim.alizz.my.id`
- Admin dashboard: `https://xlim.alizz.my.id/admin.html` atau `https://xlim.alizz.my.id/admin`

## Cara deploy Vercel

Upload semua isi folder ini ke Vercel. Minimal `index.html` dan `admin.html` sudah bisa tampil rapi karena CSS/JS inline, tapi tetap upload folder `assets` untuk gambar OG/fallback.

## Kalau masih tampil polos

Yang terbuka bukan ZIP ini, deploy belum replace file lama, atau cache CDN/browser masih lama. Lakukan redeploy, clear cache, lalu coba private tab.
