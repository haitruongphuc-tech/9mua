import { createReadStream, createWriteStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { ImageStore } from './image-store';

// Kho video ngoài theo chuẩn S3 (Cloudflare R2 hoặc tương tự) — SPEC-creator.md V5.1 mục 9. File phát thẳng từ
// STORAGE_PUBLIC_URL (vd. https://media.9mua.com). Khoá chỉ dùng ở máy chủ, không bao giờ gửi xuống trình duyệt.
const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.m4s': 'video/iso.segment',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
export const contentTypeOf = (key: string) =>
  TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';

// Đủ cho các lệnh dùng ở đây; S3Client thật và FakeS3Client đều khớp.
export type S3Like = { send(command: object): Promise<unknown> };

export class S3MediaStore implements ImageStore {
  private readonly base: string;

  constructor(
    private readonly client: S3Like,
    private readonly bucket: string,
    publicUrl: string,
  ) {
    this.base = publicUrl.replace(/\/+$/, '');
  }

  private url(key: string) {
    return `${this.base}/${key}`;
  }

  keyOf(url: string): string | null {
    return url.startsWith(`${this.base}/`) ? url.slice(this.base.length + 1) : null;
  }

  owns(url: string): boolean {
    return this.keyOf(url) !== null;
  }

  private put(key: string, body: Buffer | Readable, length?: number) {
    return this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentLength: length,
        ContentType: contentTypeOf(key),
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async save(key: string, data: Buffer): Promise<string> {
    await this.put(key, data, data.length);
    return this.url(key);
  }

  // Tải file lên rồi xoá file tạm (giống kho trên VPS: file được "chuyển" vào kho).
  async saveFile(key: string, sourcePath: string): Promise<string> {
    const url = await this.upload(key, sourcePath);
    await unlink(sourcePath);
    return url;
  }

  // Tải lên nhưng giữ file trên VPS (lệnh chuyển file cũ chỉ xoá sau khi đọc lại khớp dung lượng).
  async upload(key: string, sourcePath: string): Promise<string> {
    const { size } = await stat(sourcePath);
    await this.put(key, createReadStream(sourcePath), size);
    return this.url(key);
  }

  async sizeOf(url: string): Promise<number | null> {
    const key = this.keyOf(url);
    if (!key) return null;
    try {
      const head = (await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }))) as {
        ContentLength?: number;
      };
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  // Tải một file về máy (Duet cần file video gốc trên đĩa để ghép).
  async download(url: string, dest: string): Promise<boolean> {
    const key = this.keyOf(url);
    if (!key) return false;
    const res = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))) as {
      Body?: Readable;
    };
    if (!res.Body) return false;
    await pipeline(res.Body, createWriteStream(dest));
    return true;
  }

  // File ở kho ngoài không có đường dẫn trên VPS (Duet tải về bằng download).
  localPath: ImageStore['localPath'] = () => null;

  async remove(url: string): Promise<void> {
    const key = this.keyOf(url);
    if (key) await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async removeDir(urlPrefix: string): Promise<void> {
    const key = this.keyOf(urlPrefix.replace(/\/+$/, ''));
    // Chỉ xoá thư mục con của videos/ (không bao giờ xoá cả kho).
    if (!key || !key.startsWith('videos/') || key.split('/').length < 2) return;
    for (const page of await this.list(`${key}/`))
      if (page.length)
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: page.map((k) => ({ Key: k })), Quiet: true },
          }),
        );
  }

  // Danh sách khoá theo tiền tố, từng trang (tối đa 1.000 khoá mỗi trang theo chuẩn S3).
  async list(prefix: string): Promise<string[][]> {
    return (await this.listObjects(prefix)).map((page) => page.map((o) => o.key));
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number; lastModified: Date | null }[][]> {
    const pages: { key: string; size: number; lastModified: Date | null }[][] = [];
    let token: string | undefined;
    do {
      const res = (await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      )) as {
        Contents?: { Key?: string; Size?: number; LastModified?: Date }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
      };
      pages.push(
        (res.Contents ?? [])
          .filter((o) => o.Key)
          .map((o) => ({ key: o.Key!, size: o.Size ?? 0, lastModified: o.LastModified ?? null })),
      );
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return pages;
  }
}

type FakeObject = {
  bucket: string;
  body: Buffer;
  contentType?: string;
  cacheControl?: string;
  lastModified: Date;
};

async function toBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c as Buffer));
    return Buffer.concat(chunks);
  }
  return Buffer.from(String(body ?? ''));
}

// Driver giả (STORAGE_DRIVER=fake) cho dev/test: giữ file trong bộ nhớ, trả lời như S3 (danh sách 1.000 khoá mỗi trang).
// wrongSize: test lệnh chuyển file cũ khi kho ngoài trả dung lượng không khớp.
export class FakeS3Client implements S3Like {
  readonly objects = new Map<string, FakeObject>();
  wrongSize = false;

  async send(command: object): Promise<unknown> {
    if (command instanceof PutObjectCommand) {
      const i = command.input;
      this.objects.set(i.Key!, {
        bucket: i.Bucket!,
        body: await toBuffer(i.Body),
        contentType: i.ContentType,
        cacheControl: i.CacheControl,
        lastModified: new Date(),
      });
      return {};
    }
    if (command instanceof HeadObjectCommand) {
      const o = this.objects.get(command.input.Key!);
      if (!o) throw Object.assign(new Error('NotFound'), { name: 'NotFound' });
      return { ContentLength: o.body.length + (this.wrongSize ? 1 : 0) };
    }
    if (command instanceof GetObjectCommand) {
      const o = this.objects.get(command.input.Key!);
      if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
      return { Body: Readable.from(o.body) };
    }
    if (command instanceof DeleteObjectCommand) {
      this.objects.delete(command.input.Key!);
      return {};
    }
    if (command instanceof DeleteObjectsCommand) {
      for (const o of command.input.Delete?.Objects ?? []) this.objects.delete(o.Key!);
      return {};
    }
    if (command instanceof ListObjectsV2Command) {
      const keys = [...this.objects.keys()].filter((k) => k.startsWith(command.input.Prefix ?? '')).sort();
      const start = command.input.ContinuationToken ? Number(command.input.ContinuationToken) : 0;
      const page = keys.slice(start, start + 1000);
      const next = start + page.length;
      return {
        Contents: page.map((k) => ({
          Key: k,
          Size: this.objects.get(k)!.body.length,
          LastModified: this.objects.get(k)!.lastModified,
        })),
        IsTruncated: next < keys.length,
        NextContinuationToken: next < keys.length ? String(next) : undefined,
      };
    }
    throw new Error(`FakeS3Client: chưa hỗ trợ ${command.constructor.name}`);
  }
}
