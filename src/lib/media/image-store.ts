import { copyFile, mkdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';

// Lưu file công khai. Production: ổ đĩa VPS (Nginx phục vụ /uploads). Sau này có thể thay bằng R2/Bunny.
export interface ImageStore {
  save(key: string, data: Buffer): Promise<string>;
  // Chuyển một file đã có (vd. video vừa chuyển mã) vào kho công khai; file nguồn bị xoá.
  saveFile(key: string, sourcePath: string): Promise<string>;
  remove(url: string): Promise<void>;
  // Xoá cả thư mục (bản HLS của video dài có hàng trăm đoạn 6 giây).
  removeDir(urlPrefix: string): Promise<void>;
  // Đường dẫn trên đĩa của một file đã lưu (worker cần để ghép Duet). null nếu không phải file của kho này.
  localPath(url: string): string | null;
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

  async saveFile(key: string, sourcePath: string): Promise<string> {
    const target = resolveUploadPath(this.root, key.split('/'));
    if (!target) throw new Error(`Khoá file không hợp lệ: ${key}`);
    await mkdir(path.dirname(target), { recursive: true });
    // Thư mục tạm và UPLOAD_DIR có thể nằm trên 2 ổ khác nhau (2 volume Docker): rename lỗi thì chép rồi xoá.
    await rename(sourcePath, target).catch(async () => {
      await copyFile(sourcePath, target);
      await unlink(sourcePath);
    });
    return `/uploads/${key}`;
  }

  localPath(url: string): string | null {
    if (!url.startsWith('/uploads/')) return null;
    return resolveUploadPath(this.root, url.slice('/uploads/'.length).split('/'));
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;
    const target = resolveUploadPath(this.root, url.slice('/uploads/'.length).split('/'));
    if (target) await unlink(target).catch(() => {});
  }

  async removeDir(urlPrefix: string): Promise<void> {
    if (!urlPrefix.startsWith('/uploads/')) return;
    const parts = urlPrefix.slice('/uploads/'.length).split('/').filter(Boolean);
    // Chỉ xoá thư mục con của videos/ (không bao giờ xoá cả UPLOAD_DIR).
    if (parts[0] !== 'videos' || parts.length < 2) return;
    const target = resolveUploadPath(this.root, parts);
    if (target) await rm(target, { recursive: true, force: true });
  }
}

let store: ImageStore | undefined;

export function imageStore(): ImageStore {
  store ??= new LocalImageStore(env().UPLOAD_DIR);
  return store;
}
