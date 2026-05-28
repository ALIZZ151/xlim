'use strict';

const crypto = require('crypto');
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Pakai: npm run hash:admin -- password-minimal-8-karakter');
  process.exit(1);
}
const salt = crypto.randomBytes(24).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
console.log('ADMIN_PASSWORD_SALT=' + salt);
console.log('ADMIN_PASSWORD_HASH=' + hash);
console.log('ADMIN_SESSION_SECRET=' + crypto.randomBytes(48).toString('hex'));
console.log('ADMIN_API_HASH_SECRET=' + crypto.randomBytes(48).toString('hex'));
