import crypto from 'node:crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function resolveKey() {
  const raw = env.encryptionKey.trim();
  // Accept 64-char hex (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Otherwise treat as base64 and expect 32 bytes
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 32) {
    return buf;
  }
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64 of 32 bytes)');
}

const KEY = resolveKey();

export function encrypt(plainText) {
  if (plainText === undefined || plainText === null || plainText === '') {
    return '';
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(payload) {
  if (!payload) {
    return '';
  }
  const parts = String(payload).split(':');
  if (parts.length !== 3) {
    return '';
  }
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function maskSecret(value) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= 4) return '••••';
  return `••••••••${str.slice(-4)}`;
}

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
