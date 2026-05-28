-- XLIMSTORE legacy product seed.
-- Import after supabase/schema.sql.
-- Gambar legacy tetap dipertahankan sebagai asset publik di /assets/img.
-- Produk baru dari admin akan memakai Supabase Storage bucket `product-images`.

insert into public.products (
  slug, name, category, price, price_label, description, features, image_url,
  status, is_active, sort_order, created_at, updated_at
) values
(
  'akun-ff-google-15k',
  'Akun FF Google 15K',
  'Akun FF',
  15000,
  'Rp 15.000',
  'Akun FF siap pakai buat yang mau mulai gas tanpa ribet. Detail tetap bisa ditanyakan ke admin sebelum order.',
  '["LOG GOOGLE", "BIND KOSONG", "NO LENGKET", "GARANSI 30 HARI"]'::jsonb,
  '/assets/img/product-akun-ff-15k.webp',
  'ready',
  true,
  10,
  '2026-05-24T00:00:00.000Z',
  '2026-05-24T00:00:00.000Z'
),
(
  'akun-ff-google-30k',
  'Akun FF Google 30K',
  'Akun FF',
  30000,
  'Rp 30.000',
  'Pilihan lebih aman buat pembeli yang ingin garansi lebih panjang dan detail akun jelas.',
  '["LOG GOOGLE", "BIND KOSONG", "NO LENGKET", "GARANSI SEUMUR HIDUP"]'::jsonb,
  '/assets/img/product-akun-ff-30k.webp',
  'ready',
  true,
  20,
  '2026-05-24T00:00:00.000Z',
  '2026-05-24T00:00:00.000Z'
),
(
  'sewa-bot-whatsapp',
  'Sewa Bot WhatsApp',
  'Bot WhatsApp',
  10000,
  'Per minggu: Rp 5.000 · Per bulan: Rp 10.000',
  'Cocok untuk kebutuhan otomatisasi WhatsApp. Bisa pilih mingguan atau bulanan, tinggal chat admin buat setup.',
  '["FULL GARANSI", "Cocok untuk kebutuhan otomatisasi WhatsApp", "Harga mingguan dan bulanan"]'::jsonb,
  '/assets/img/product-sewa-bot-whatsapp.webp',
  'ready',
  true,
  30,
  '2026-05-24T00:00:00.000Z',
  '2026-05-24T00:00:00.000Z'
),
(
  'nokos-whatsapp-indonesia',
  'Nokos WhatsApp Indonesia',
  'Nokos',
  5000,
  'Rp 5.000',
  'Nokos WhatsApp Indonesia dengan kualitas oke dan full garansi. Mau tanya stok dulu? Chat admin aja.',
  '["NOKOST INDONESIA", "BERKUALITAS", "FULL GARANSI"]'::jsonb,
  '/assets/img/product-nokos-whatsapp.webp',
  'ready',
  true,
  40,
  '2026-05-24T00:00:00.000Z',
  '2026-05-24T00:00:00.000Z'
)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  price = excluded.price,
  price_label = excluded.price_label,
  description = excluded.description,
  features = excluded.features,
  image_url = excluded.image_url,
  status = excluded.status,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
