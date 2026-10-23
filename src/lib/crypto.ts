import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

// Mã hoá dữ liệu bí mật lưu trong DB (bí mật TOTP của admin) bằng AES-256-GCM với APP_ENCRYPTION_KEY.
// Dạng lưu: v1.<iv>.<tag>.<ciphertext> (base64url). Lộ DB mà không lộ .env thì không đọc được.
export function encryptSecret(plain: string): string {
  const key = Buffer.from(env().APP_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Dữ liệu mã hoá không đúng định dạng');
  const key = Buffer.from(env().APP_ENCRYPTION_KEY, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
