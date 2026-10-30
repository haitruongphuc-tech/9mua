import { copyFile, mkdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { FakeS3Client, S3MediaStore } from './s3-store';

// Lưu file công khai: ổ đĩa VPS (Nginx phục vụ /uploads); file video mới lên kho ngoài khi bật external_storage.
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

// Kho video ngoài (SPEC-creator.md V5.1 mục 9): chỉ có khi điền đủ khoá STORAGE_* (hoặc driver fake ở dev/test).
let external: S3MediaStore | null | undefined;
let fake: FakeS3Client | null = null;

// Chỉ cho dev/test: đọc file trong driver fake.
export function fakeS3(): FakeS3Client | null {
  externalStore();
  return fake;
}

export function externalStore(): S3MediaStore | null {
  if (external !== undefined) return external;
  const e = env();
  if (e.STORAGE_DRIVER === 'fake') {
    fake = new FakeS3Client();
    external = new S3MediaStore(fake, 'fake', e.STORAGE_PUBLIC_URL ?? 'http://media.fake.local');
  } else if (
    e.STORAGE_S3_ENDPOINT &&
    e.STORAGE_S3_BUCKET &&
    e.STORAGE_S3_KEY &&
    e.STORAGE_S3_SECRET &&
    e.STORAGE_PUBLIC_URL
  )
    external = new S3MediaStore(
      new S3Client({
        region: e.STORAGE_S3_REGION,
        endpoint: e.STORAGE_S3_ENDPOINT,
        credentials: { accessKeyId: e.STORAGE_S3_KEY, secretAccessKey: e.STORAGE_S3_SECRET },
      }),
      e.STORAGE_S3_BUCKET,
      e.STORAGE_PUBLIC_URL,
    );
  else external = null;
  return external;
}

// Nơi ghi file video MỚI: kho ngoài khi bật công tắc external_storage và có khoá, còn lại trên VPS. Worker chọn một lần
// cho mỗi video để mọi file của video (cả thư mục HLS) nằm cùng một nơi.
export async function videoStore(): Promise<ImageStore> {
  const ext = externalStore();
  return ext && (await isFeatureOn('external_storage')) ? ext : localStore();
}

// Ghi theo khoá (videos/… theo videoStore, còn lại trên VPS); đọc, xoá theo link (link kho ngoài hay /uploads/).
class RoutingStore implements ImageStore {
  constructor(private readonly local: LocalImageStore) {}

  private writer(key: string): Promise<ImageStore> {
    return key.startsWith('videos/') ? videoStore() : Promise.resolve(this.local);
  }

  private reader(url: string): ImageStore {
    return externalStore()?.owns(url) ? externalStore()! : this.local;
  }

  async save(key: string, data: Buffer) {
    return (await this.writer(key)).save(key, data);
  }

  async saveFile(key: string, sourcePath: string) {
    return (await this.writer(key)).saveFile(key, sourcePath);
  }

  localPath(url: string) {
    return this.local.localPath(url);
  }

  remove(url: string) {
    return this.reader(url).remove(url);
  }

  removeDir(urlPrefix: string) {
    return this.reader(urlPrefix).removeDir(urlPrefix);
  }
}

let local: LocalImageStore | undefined;
let store: ImageStore | undefined;

export function localStore(): LocalImageStore {
  local ??= new LocalImageStore(env().UPLOAD_DIR);
  return local;
}

export function imageStore(): ImageStore {
  store ??= new RoutingStore(localStore());
  return store;
}

// Chỉ cho test: đọc lại cấu hình kho sau khi đổi biến môi trường.
export function resetMediaStores(): void {
  external = undefined;
  fake = null;
  local = undefined;
  store = undefined;
}
