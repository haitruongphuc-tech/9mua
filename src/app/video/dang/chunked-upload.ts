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

// Gửi một phần bằng XMLHttpRequest (như đường tải một lần vốn chạy tốt trên iPhone), có tiến độ từng byte.
// fetch() với Blob cắt từ video trong Ảnh trên iPhone gửi sai số byte (log 31/10: mọi phần bị BAD_PART). Trả 0 khi rớt mạng.
function putPart(url: string, body: Blob, onLoaded: (bytes: number) => void): Promise<number> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => onLoaded(e.loaded);
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () => resolve(0);
    xhr.ontimeout = () => resolve(0);
    xhr.send(body);
  });
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
  let inFlight = 0; // byte của phần đang gửi, để thanh tiến độ chạy trong lúc gửi (không đứng 0% tới hết 8MB)
  const done = () => Math.min(have.size * session.partSize, file.size);
  const report = () => {
    const elapsed = (Date.now() - started) / 1000;
    const speed = elapsed > 0 ? (sent + inFlight) / elapsed : 0;
    const left = Math.max(file.size - done() - inFlight, 0);
    onProgress({
      pct: Math.min(99, Math.round(((done() + inFlight) / file.size) * 100)),
      bytesPerSec: speed,
      etaSec: speed > 0 ? Math.round(left / speed) : null,
    });
  };
  report();
  for (let n = 0; n < session.parts; n++) {
    if (have.has(n)) continue;
    // File chỉ 1 phần thì gửi nguyên file, không cắt: iPhone (WebKit) gửi sai dữ liệu khi cắt video lấy từ Ảnh.
    const blob = session.parts === 1 ? file : file.slice(n * session.partSize, (n + 1) * session.partSize);
    let ok = false;
    // Mỗi phần thử tối đa 5 lần, chờ dài dần (mạng 4G chập chờn).
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      if (attempt) await sleep(1000 * 2 ** attempt);
      inFlight = 0;
      const status = await putPart(`/api/uploads/video/${session.id}/parts/${n}`, blob, (loaded) => {
        inFlight = Math.min(loaded, blob.size);
        report();
      });
      if (status === 404) {
        remember(key, null);
        return { ok: false, message: messages.failed };
      }
      ok = status >= 200 && status < 300;
    }
    inFlight = 0;
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
