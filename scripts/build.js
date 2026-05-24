const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'public');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
copyDir(src, dist);

const cfg = {
  API_BASE_URL: process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'https://admin-xlim.alizz.my.id',
  WHATSAPP_NUMBER: process.env.VITE_WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER || '628xxxxxxxxxx',
  SITE_URL: process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://xlim.alizz.my.id',
};
fs.writeFileSync(path.join(dist, 'config.js'), `window.XLIMSTORE_CONFIG=${JSON.stringify(cfg, null, 2)};\n`);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/demo','/produk','/rating'].map((route) => `  <url><loc>${cfg.SITE_URL}${route}</loc><changefreq>weekly</changefreq><priority>${route === '/produk' ? '0.9' : '0.7'}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${cfg.SITE_URL}/sitemap.xml\n`);
console.log('XLIMSTORE frontend build ready:', dist);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}
