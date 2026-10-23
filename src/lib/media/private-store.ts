import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { resolveUploadPath } from './image-store';

// File riêng tư (ảnh CCCD): lưu trong PRIVATE_DIR, KHÔNG có URL công khai; chỉ đọc qua route có kiểm quyền.
export async function savePrivate(key: string, data: Buffer): Promise<string> {
  const target = resolveUploadPath(env().PRIVATE_DIR, key.split('/'));
  if (!target) throw new Error(`Khoá file riêng tư không hợp lệ: ${key}`);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  await writeFile(target, data, { flag: 'wx', mode: 0o640 });
  return key;
}

export async function readPrivate(key: string): Promise<Buffer | null> {
  const target = resolveUploadPath(env().PRIVATE_DIR, key.split('/'));
  if (!target) return null;
  return readFile(target).catch(() => null);
}
