import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalImageStore, resolveUploadPath } from './image-store';

describe('LocalImageStore', () => {
  it('ghi file vào thư mục upload và trả URL /uploads/…', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), '9mua-up-'));
    const store = new LocalImageStore(dir);
    const url = await store.save('products/2026/10/abc.webp', Buffer.from('x'));
    expect(url).toBe('/uploads/products/2026/10/abc.webp');
    expect(await readFile(path.join(dir, 'products/2026/10/abc.webp'), 'utf8')).toBe('x');
  });

  it('chặn đường dẫn thoát ra ngoài thư mục upload', () => {
    expect(resolveUploadPath('/data/up', ['..', 'etc', 'passwd'])).toBeNull();
    expect(resolveUploadPath('/data/up', ['a', '..', '..', 'x'])).toBeNull();
    expect(resolveUploadPath('/data/up', ['products', 'a.webp'])).toBe('/data/up/products/a.webp');
  });
});
