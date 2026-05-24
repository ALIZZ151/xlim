# XLIMSTORE Frontend Final

Frontend ini tetap static dan ringan untuk Vercel, tapi sudah dipisah menjadi `index.html`, `admin.html`, `assets/css`, dan `assets/js`.

## Konfigurasi

Edit `assets/js/site-config.js` sebelum deploy:

```js
apiBaseUrl: 'https://domain-backend-pterodactyl-kamu.example',
whatsappNumber: '628xxxxxxxxxx',
siteUrl: 'https://domain-frontend-kamu.vercel.app'
```

Jangan masukkan secret/token admin ke frontend. File ini hanya untuk config publik.

## Deploy Vercel

1. Upload folder frontend ini ke repository/GitHub.
2. Import ke Vercel sebagai static project tanpa build command.
3. Pastikan `site-config.js` memakai URL backend HTTPS yang benar.
4. Setelah deploy, update `FRONTEND_ORIGIN` di backend agar sama dengan domain Vercel.

## Testing frontend

- Buka homepage.
- Pastikan produk load dari backend.
- Test search, filter kategori, dan sort.
- Buka detail produk dan tekan checkout.
- Pastikan WhatsApp message berisi produk, harga, status, dan catatan.
- Buka `/admin.html`, login, tambah/edit/hapus produk.
- Cek mobile view dan focus state keyboard.
