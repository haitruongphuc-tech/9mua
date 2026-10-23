import { env } from '@/lib/env';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type EmailContent = {
  title: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
};

// Mẫu email chung: logo 9MUA, nút cam chữ đen theo docs/BRAND.md, kèm bản text thuần.
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const appUrl = env().APP_URL;
  const p = (t: string) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(t)}</p>`;
  const button = content.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#fc6f15;color:#1a1410;border:2px solid #1a1410;border-radius:999px;padding:12px 24px;font-weight:800;text-decoration:none">${escapeHtml(content.action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="vi"><body style="margin:0;background:#f5f5f7;font-family:Arial,sans-serif;color:#1a1410">
<div style="max-width:520px;margin:0 auto;padding:24px">
<img src="${appUrl}/brand/9mua-logo.png" alt="9MUA" width="72" style="display:block;margin:0 auto 16px">
<div style="background:#fff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(content.title)}</h1>
${p(content.greeting)}${content.paragraphs.map(p).join('')}${button}
${content.footnote ? `<p style="margin:0;font-size:13px;color:#555">${escapeHtml(content.footnote)}</p>` : ''}
</div>
<p style="font-size:12px;color:#777;text-align:center;margin-top:16px">9MUA CO.,LTD · MST 3401295437 · 115 Nguyễn Hậu, P. Phú Thọ Hòa, TP.HCM</p>
</div></body></html>`;
  const text = [
    content.title,
    '',
    content.greeting,
    ...content.paragraphs,
    ...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footnote ? ['', content.footnote] : []),
    '',
    '9MUA CO.,LTD',
  ].join('\n');
  return { html, text };
}
