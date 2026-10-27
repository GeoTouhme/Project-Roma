'use strict';
const crypto = require('crypto');
function key(secret) {
  if (!secret) throw new Error('MFA encryption configuration unavailable');
  return crypto.scryptSync(secret, 'project-roma-mfa', 32);
}
function encryptMfaSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(process.env.MFA_SECRET_KEY || process.env.JWT_SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return 'v2:' + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
function decryptWithSecret(value, secret) {
  const buffer = Buffer.from(value.replace(/^v2:/, ''), 'base64');
  if (buffer.length < 33) throw new Error('Invalid MFA ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(secret), buffer.subarray(0, 16));
  decipher.setAuthTag(buffer.subarray(16, 32));
  return Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()]).toString('utf8');
}
function decryptMfaSecret(value) {
  if (!value) return null;
  for (const secret of [process.env.MFA_SECRET_KEY || process.env.JWT_SECRET, process.env.MFA_PREVIOUS_SECRET_KEY].filter(Boolean)) {
    try { return decryptWithSecret(value, secret); } catch {}
  }
  throw new Error('Unable to decrypt MFA enrollment');
}
module.exports = { encryptMfaSecret, decryptMfaSecret, decryptWithSecret };
