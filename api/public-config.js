export default function handler(req, res) {
  const config = {
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    SITE_URL: process.env.VITE_SITE_URL || process.env.SITE_URL || ''
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).send(`window.__XLIM_CONFIG__ = ${JSON.stringify(config)};`);
}
