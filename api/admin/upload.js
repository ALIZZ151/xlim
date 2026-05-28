'use strict';
const fs = require('fs/promises');
const path = require('path');
let formidablePkg = require('formidable');
const formidable = formidablePkg.formidable || formidablePkg;
const { withApi, ok, methodNotAllowed, ApiError } = require('../_lib/responses');
const { getSupabaseAdmin } = require('../_lib/supabase');
const { config } = require('../_lib/config');
const { requireAdmin, audit, requestIntegrityHash } = require('../_lib/auth');
const { randomId, sanitizeText, sha256 } = require('../_lib/utils');

const ALLOWED = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

module.exports = withApi(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  await requireAdmin(req);
  const { files } = await parseForm(req);
  const file = Array.isArray(files.image) ? files.image[0] : files.image || (Array.isArray(files.file) ? files.file[0] : files.file);
  if (!file) throw new ApiError('File gambar wajib diupload.', 400, 'NO_FILE');
  const mime = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED.has(mime)) throw new ApiError('Format gambar harus JPG, PNG, atau WebP.', 400, 'BAD_FILE_TYPE');
  if (Number(file.size || 0) > config.maxUploadBytes) throw new ApiError('Ukuran gambar terlalu besar.', 413, 'FILE_TOO_LARGE');
  const buffer = await fs.readFile(file.filepath);
  if (!validMagic(buffer, mime)) throw new ApiError('Isi file tidak cocok dengan format gambar.', 400, 'BAD_FILE_MAGIC');
  const ext = ALLOWED.get(mime);
  const safeName = sanitizeText(path.parse(file.originalFilename || 'produk').name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produk';
  const objectName = `products/${Date.now()}-${randomId(8)}-${safeName}.${ext}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(config.supabaseStorageBucket).upload(objectName, buffer, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new ApiError(error.message || 'Upload ke Supabase Storage gagal.', 500, 'UPLOAD_FAILED');
  const { data } = supabase.storage.from(config.supabaseStorageBucket).getPublicUrl(objectName);
  const publicUrl = data?.publicUrl || '';
  await audit('product_image_uploaded', req, {
    objectName,
    mime,
    size: file.size,
    signature: requestIntegrityHash(req, sha256(objectName)),
  });
  ok(res, { url: publicUrl, path: objectName, message: 'Gambar berhasil diupload.' }, 201);
});

function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: config.maxUploadBytes,
    allowEmptyFiles: false,
    filter(part) { return ['image', 'file'].includes(part.name || '') && ALLOWED.has(String(part.mimetype || '').toLowerCase()); },
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(new ApiError(err.message || 'Upload gagal diproses.', err.httpCode || 400, 'UPLOAD_PARSE_ERROR'));
      resolve({ fields, files });
    });
  });
}

function validMagic(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}
