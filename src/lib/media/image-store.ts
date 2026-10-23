import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

// Lưu file công khai. Production: ổ đĩa VPS (Nginx phục vụ /uploads). Sau này có thể thay bằng R2/Bunny.
export interface ImageStore {
  save(key: string, data: Buffer): Promise<string>;
  remove(url: string): Promise<void>;
}

// Trả null nếu đường dẫn thoát ra ngoài thư mục gốc (../).
export function resolveUploadPath(root: string, segments: string[]): string | null {
  const base = path.resolve(root);
  const target = path.resolve(base, ...segments);
  return target.startsWith(base + path.sep) ? target : null;
}

export class LocalImageStore implements ImageStore {
  constructor(private readonly root: string) {}

  async save(key: string, data: Buffer): Promise<string> {
    const target = resolveUploadPath(this.root, key.split('/'));
    if (!target) throw new Error(`Khoá file không hợp lệ: ${key}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
    return `/uploads/${key}`;
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;
    const target = resolveUploadPath(this.root, url.slice('/uploads/'.length).split('/'));
    if (target) await unlink(target).catch(() => {});
  }
}

let store: ImageStore | undefined;

export function imageStore(): ImageStore {
  store ??= new LocalImageStore(env().UPLOAD_DIR);
  return store;
}
