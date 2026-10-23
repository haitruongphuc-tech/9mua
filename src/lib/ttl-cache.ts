// Cache trong tiến trình cho dữ liệu công khai đọc nhiều (trang chủ, trang danh mục): mỗi khoá giữ N giây.
// Không dùng ISR của Next vì lúc build Docker chưa có database để dựng sẵn trang.
const store = new Map<string, { until: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const nowMs = Date.now();
  const hit = store.get(key);
  if (hit && hit.until > nowMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { until: nowMs + ttlSeconds * 1000, value });
  // Lỗi thì không giữ trong cache, lần sau tải lại.
  value.catch(() => store.delete(key));
  if (store.size > 500) for (const [k, v] of store) if (v.until <= nowMs) store.delete(k);
  return value;
}
