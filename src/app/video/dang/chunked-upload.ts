// Tải video lên từng phần 8MB (SPEC-creator.md V5.1 mục 3). Rớt mạng hoặc tải lại trang: nhận ra cùng file nhờ tên +
// dung lượng + ngày sửa lưu trong localStorage, hỏi máy chủ phần đã nhận rồi gửi tiếp phần còn thiếu.
export type UploadProgress = { pct: number; bytesPerSec: number; etaSec: number | null };

type Result = { ok: boolean; uploadId?: string; message?: string };

const keyOf = (f: File) => `nm.upload:${f.name}:${f.size}:${f.lastModified}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function remember(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function chunkedUpload(
  file: File,
  durationSec: number | null,
  onProgress: (p: UploadProgress) => void,
  messages: { failed: string; offline: string },
): Promise<Result> {
  const key = keyOf(file);
  let session: { id: string; parts: number; partSize: number; received: number[] } | null = null;
  const saved = recall(key);
  if (saved) {
    const r = await fetch(`/api/uploads/video/${saved}`).catch(() => null);
    const s = r?.ok ? ((await r.json()) as { parts: number; partSize: number; received: number[] }) : null;
    if (s) session = { id: saved, ...s };
    else remember(key, null);
  }
  if (!session) {
    const r = await fetch('/api/uploads/video', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, size: file.size, durationSec }),
    }).catch(() => null);
    if (!r) return { ok: false, message: messages.offline };
    const body = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      sessionId?: string;
      parts?: number;
      partSize?: number;
      message?: string;
    };
    if (!body.ok || !body.sessionId) return { ok: false, message: body.message ?? messages.failed };
    session = { id: body.sessionId, parts: body.parts!, partSize: body.partSize!, received: [] };
    remember(key, session.id);
  }

  const have = new Set(session.received);
  const started = Date.now();
  let sent = 0;
  const done = () => have.size * session.partSize;
  const report = () => {
    const elapsed = (Date.now() - started) / 1000;
    const speed = elapsed > 0 ? sent / elapsed : 0;
    const left = Math.max(file.size - done(), 0);
    onProgress({
      pct: Math.min(99, Math.round((Math.min(done(), file.size) / file.size) * 100)),
      bytesPerSec: speed,
      etaSec: speed > 0 ? Math.round(left / speed) : null,
    });
  };
  report();
  for (let n = 0; n < session.parts; n++) {
    if (have.has(n)) continue;
    const blob = file.slice(n * session.partSize, (n + 1) * session.partSize);
    let ok = false;
    // Mỗi phần thử tối đa 5 lần, chờ dài dần (mạng 4G chập chờn).
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      if (attempt) await sleep(1000 * 2 ** attempt);
      const r = await fetch(`/api/uploads/video/${session.id}/parts/${n}`, {
        method: 'PUT',
        body: blob,
      }).catch(() => null);
      if (r?.status === 404) {
        remember(key, null);
        return { ok: false, message: messages.failed };
      }
      ok = Boolean(r?.ok);
    }
    if (!ok) return { ok: false, message: messages.offline }; // giữ phiên: bấm đăng lại sẽ gửi tiếp
    have.add(n);
    sent += blob.size;
    report();
  }
  const r = await fetch(`/api/uploads/video/${session.id}/complete`, { method: 'POST' }).catch(() => null);
  if (!r) return { ok: false, message: messages.offline };
  const body = (await r.json().catch(() => ({}))) as Result;
  if (body.ok) remember(key, null);
  onProgress({ pct: 100, bytesPerSec: 0, etaSec: 0 });
  return body.ok
    ? { ok: true, uploadId: body.uploadId }
    : { ok: false, message: body.message ?? messages.failed };
}
