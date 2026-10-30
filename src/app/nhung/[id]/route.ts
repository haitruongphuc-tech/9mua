import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { embedVideo } from '@/modules/creator';

export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Trang nhúng (SPEC-creator.md V5.7 mục 2): chỉ có video, @tên và nút "Xem trên 9MUA"; chỉ video công khai. Trả HTML
// tối giản (không có thanh trên/menu dưới của web); middleware cho phép web khác nhúng riêng đường /nhung/*.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureOn('share_more'))) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const v = await embedVideo(id);
  if (!v) return new Response('Not found', { status: 404 });
  const t = await getT();
  const app = env().APP_URL;
  const watch = `${app}/v/${encodeURIComponent(v.id)}`;
  const html = `<!doctype html>
<html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(v.caption || '9MUA')} · 9MUA</title><meta name="robots" content="noindex">
<style>
html,body{margin:0;height:100%;background:#000;color:#fff;font-family:system-ui,sans-serif}
.box{position:relative;height:100%;display:flex;align-items:center;justify-content:center}
video{max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;background:#000}
.bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(transparent,rgba(0,0,0,.75));pointer-events:none}
.bar *{pointer-events:auto}.name{font-weight:800;font-size:14px;color:#fff;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.go{flex-shrink:0;background:#ff6b00;color:#fff;font-weight:800;font-size:13px;padding:8px 14px;border-radius:999px;text-decoration:none}
</style></head><body><div class="box">
<video src="${esc(v.fileUrl)}"${v.posterUrl ? ` poster="${esc(v.posterUrl)}"` : ''} controls playsinline preload="metadata" data-testid="embed-video"></video>
<div class="bar"><a class="name" href="${esc(watch)}" target="_blank" rel="noopener">@${esc(v.authorName)}</a>
<a class="go" href="${esc(watch)}" target="_blank" rel="noopener" data-testid="embed-open">${esc(t('feed.share.watchOn'))}</a></div>
</div></body></html>`;
  return new Response(html, {
    // Không lưu đệm: video chuyển riêng tư thì trang nhúng thôi hiện ngay.
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
