'use client';

import { Code2, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFeature } from '@/components/MeProvider';
import { useT } from '@/i18n/client';

// Chia sẻ thêm cho video (SPEC-creator.md V5.7, SPEC-messages.md V5.1 — công tắc share_more): TikTok/Instagram (chép link
// rồi mở app), tải về có logo, mã nhúng, gửi qua Hộp thư cho 8 cuộc trò chuyện gần nhất hoặc tìm theo tên.
export type ShareVideo = { id: string; isPublic: boolean; canDownload: boolean; canRepost?: boolean };
type Recent = { conversationId: string; name: string; avatarUrl: string | null };

const APPS = {
  tiktok: { label: 'TikTok', app: 'snssdk1233://', web: 'https://www.tiktok.com/', cls: 'bg-black' },
  instagram: {
    label: 'Instagram',
    app: 'instagram://app',
    web: 'https://www.instagram.com/',
    cls: 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5]',
  },
} as const;

export function ShareMore({
  video,
  url,
  appUrl,
  loggedIn,
  onToast,
}: {
  video: ShareVideo;
  url: string;
  appUrl: string;
  loggedIn: boolean;
  onToast: (text: string) => void;
}) {
  const t = useT();
  const on = useFeature('share_more');
  const [mobile, setMobile] = useState(false);
  const [recent, setRecent] = useState<Recent[] | null>(null);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setMobile(/Android|iPhone|iPad/i.test(navigator.userAgent)), []);
  useEffect(() => {
    if (!on || !loggedIn) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/hop-thu/gan-day?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { items: Recent[] }) => setRecent(d.items))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [on, loggedIn, query]);
  if (!on) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };
  const openApp = async (key: keyof typeof APPS) => {
    await copy();
    onToast(t('feed.share.pasteInto', { app: APPS[key].label }));
    if (mobile) window.location.href = APPS[key].app;
    else window.open(APPS[key].web, '_blank', 'noopener');
  };
  const download = async () => {
    if (!loggedIn) return window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/v/${video.id}`)}`);
    setBusy(true);
    // Lần đầu máy chủ tạo bản có logo (vài chục giây): hỏi lại mỗi 3 giây, tối đa 2 phút.
    for (let i = 0; i < 40; i++) {
      type Reply = { ok: boolean; url?: string; pending?: boolean; message?: string };
      const r: Reply = await fetch(`/api/video/${video.id}/tai-ve`, { method: 'POST' })
        .then((x) => x.json() as Promise<Reply>)
        .catch(() => ({ ok: false, message: t('feed.share.downloadFailed') }));
      if (r.ok && r.url) {
        const a = document.createElement('a');
        a.href = r.url;
        a.download = `9mua-${video.id}.mp4`;
        document.body.append(a);
        a.click();
        a.remove();
        onToast(t('feed.share.downloaded'));
        return setBusy(false);
      }
      if (!r.ok) {
        onToast(r.message ?? t('feed.share.downloadFailed'));
        return setBusy(false);
      }
      if (i === 0) onToast(t('feed.share.preparing'));
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    onToast(t('feed.share.downloadFailed'));
    setBusy(false);
  };
  // Đăng lại (SPEC-social.md V5.9): video public của người khác.
  const repost = async () => {
    if (!loggedIn) return window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/v/${video.id}`)}`);
    const r = await fetch('/api/social/repost', {
      method: 'POST',
      body: JSON.stringify({ videoId: video.id }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; reposted?: boolean }>)
      .catch(() => null);
    if (r?.ok) onToast(t(r.reposted ? 'feed.repost.done' : 'feed.repost.undone'));
  };
  const embed = `<iframe src="${appUrl}/nhung/${video.id}" width="325" height="580" style="border:0" allow="fullscreen" allowfullscreen></iframe>`;
  const send = async (c: Recent) => {
    const r = await fetch('/api/hop-thu/gui-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: c.conversationId, videoId: video.id, text: note }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; message?: string }>)
      .catch(() => ({ ok: false, message: t('feed.share.sendFailed') }));
    if (r.ok) {
      setSentTo((list) => [...list, c.conversationId]);
      onToast(t('feed.share.sent', { name: c.name }));
    } else onToast(r.message ?? t('feed.share.sendFailed'));
  };

  const circle = 'grid h-12 w-12 place-items-center rounded-full text-white font-black text-[13px]';
  return (
    <div className="mt-4 flex flex-col gap-4" data-testid="share-more">
      {loggedIn ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold text-zinc-500">{t('feed.share.sendTo')}</p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('feed.share.searchPeople')}
            className="h-10 rounded-full border border-black/10 bg-zinc-50 px-4 text-[13px]"
            data-testid="share-search"
          />
          {recent && recent.length === 0 ? (
            <p className="text-[12px] text-zinc-500">{t('feed.share.noChats')}</p>
          ) : null}
          <ul className="flex gap-3 overflow-x-auto pb-1" data-testid="share-recent">
            {(recent ?? []).map((c) => {
              const sent = sentTo.includes(c.conversationId);
              return (
                <li key={c.conversationId} className="w-16 shrink-0">
                  <button
                    type="button"
                    onClick={() => void send(c)}
                    disabled={sent}
                    className="flex w-full flex-col items-center gap-1"
                    data-testid="share-send"
                  >
                    <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-brand font-black text-white">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        c.name.slice(0, 1).toUpperCase()
                      )}
                      {sent ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/60 text-white">
                          ✓
                        </span>
                      ) : null}
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-bold">{c.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder={t('feed.share.note')}
            className="h-10 rounded-full border border-black/10 bg-zinc-50 px-4 text-[13px]"
            data-testid="share-note"
          />
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-3">
        {(Object.keys(APPS) as (keyof typeof APPS)[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => void openApp(key)}
            className="flex flex-col items-center gap-1"
            data-testid={`share-${key}`}
          >
            <span className={`${circle} ${APPS[key].cls}`}>{APPS[key].label.slice(0, 1)}</span>
            <span className="text-[11px] font-bold">{APPS[key].label}</span>
          </button>
        ))}
        {video.canRepost ? (
          <button
            type="button"
            onClick={() => void repost()}
            className="flex flex-col items-center gap-1"
            data-testid="share-repost"
          >
            <span className={`${circle} bg-brand`}>⟳</span>
            <span className="text-[11px] font-bold">{t('feed.repost.button')}</span>
          </button>
        ) : null}
        {video.canDownload ? (
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="flex flex-col items-center gap-1 disabled:opacity-50"
            data-testid="share-download"
          >
            <span className={`${circle} bg-zinc-700`}>
              <Download className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-[11px] font-bold">{t('feed.share.download')}</span>
          </button>
        ) : null}
        {video.isPublic ? (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(embed);
              } catch {}
              onToast(t('feed.share.embedCopied'));
            }}
            className="flex flex-col items-center gap-1"
            data-testid="share-embed"
          >
            <span className={`${circle} bg-zinc-500`}>
              <Code2 className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-[11px] font-bold">{t('feed.share.embed')}</span>
          </button>
        ) : null}
      </div>
      {video.isPublic ? (
        <textarea
          readOnly
          value={embed}
          rows={2}
          className="w-full resize-none rounded-[12px] bg-zinc-50 p-2 font-mono text-[11px] text-zinc-600"
          aria-label={t('feed.share.embed')}
          data-testid="share-embed-code"
        />
      ) : null}
    </div>
  );
}
