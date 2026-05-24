# XLIMSTORE Frontend Final

Frontend mini app XLIMSTORE yang ringan untuk Vercel. Dibuat dengan HTML/CSS/JS tanpa library berat.

## Halaman

- `/demo` — cara order, info garansi, FAQ, CTA produk.
- `/produk` — katalog, search, filter kategori, sort, detail produk/modal, order.
- `/rating` — form rating dan list rating terbaru.
- `/admin` — halaman admin tersembunyi, tidak muncul di nav publik.

## Fitur UI

- Bottom navigation mobile: Demo, Produk, Rating.
- Admin tidak tampil di navbar, bottom nav, atau halaman publik.
- Floating WhatsApp button hanya di Demo dan Produk.
- Lazy-load gambar produk.
- Reduced motion support.
- Desain cyber/neon tapi CSS ringan tanpa animasi berat.
- SEO meta, OG image, Twitter card, manifest, robots, sitemap.

## Cara deploy ke Vercel

1. Upload folder frontend ke repository/Vercel.
2. Set environment variable di Vercel:

```env
VITE_API_BASE_URL=https://admin-xlim.alizz.my.id
VITE_WHATSAPP_NUMBER=628xxxxxxxxxx
VITE_SITE_URL=https://xlim.alizz.my.id
```

3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Deploy.

`vercel.json` sudah menyiapkan rewrite untuk `/demo`, `/produk`, `/rating`, dan `/admin`.

## Local preview

```bash
npm run build
npx serve dist
```

## Catatan

- `public/config.js` hanya fallback local. Saat build, `scripts/build.js` membuat `dist/config.js` dari env Vercel.
- Secret Google, Pakasir, dan admin tidak ada di frontend.
