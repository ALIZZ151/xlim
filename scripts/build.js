'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
copyDir(publicDir, distDir);

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_ORIGIN || 'https://xlim.alizz.my.id').replace(/\/+$/, '');
const whatsappNumber = String(process.env.WHATSAPP_NUMBER || '6283193075449').replace(/\D/g, '');
const telegramUsername = String(process.env.TELEGRAM_USERNAME || 'xlimstor').replace(/^@/, '');

const config = `window.XLIMSTORE_CONFIG = ${JSON.stringify({
  API_BASE_URL: '',
  SITE_URL: siteUrl,
  WHATSAPP_NUMBER: whatsappNumber,
  TELEGRAM_USERNAME: telegramUsername
}, null, 2)};\n`;
fs.writeFileSync(path.join(distDir, 'config.js'), config);

const sitemap = `https://xlim.alizz.my.id/\nhttps://xlim.alizz.my.id/demo\nhttps://xlim.alizz.my.id/produk\nhttps://xlim.alizz.my.id/rating\n`
  .replaceAll('https://xlim.alizz.my.id', siteUrl)
  .trim()
  .split('\n')
  .map((loc) => `<url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${loc.endsWith('/produk') ? '0.9' : '0.7'}</priority></url>`)
  .join('');
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>\n`);
fs.writeFileSync(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);

console.log(`Built XLIMSTORE static assets into ${distDir}`);
