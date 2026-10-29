'use client';

import { ArrowLeft, ImagePlus, MoreHorizontal, Send, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  acceptAction,
  blockAction,
  deleteConversationAction,
  markReadAction,
  reportAction,
  sendMessageAction,
} from '@/app/hop-thu/actions';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { ConversationDetail, MessageView, ProductCard } from '@/modules/messages';

const REASONS = ['lua_dao', 'quay_roi', 'spam', 'khac'] as const;
const POLL_MS = 5_000;

// Một cuộc trò chuyện (SPEC-messages.md mục 2–8): tin mới qua SSE (lỗi thì hỏi lại mỗi 5 giây), "Đã xem", gửi chữ /
// ảnh / thẻ sản phẩm, tin nhắn chờ (chấp nhận, xoá, chặn), báo cáo. Nằm cố định giữa header và thanh dưới.
export function ChatRoom({
  meId,
  conversation,
  initial,
  attach,
}: {
  meId: string;
  conversation: ConversationDetail;
  initial: MessageView[];
  attach: ProductCard | null;
}) {
  const t = useT();
  const [messages, setMessages] = useState(initial);
  const [otherReadAt, setOtherReadAt] = useState(conversation.otherReadAt);
  const [text, setText] = useState('');
  const [product, setProduct] = useState(attach);
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [menu, setMenu] = useState<'none' | 'menu' | 'report'>('none');
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const lastId = useRef(initial.at(-1)?.id ?? null);
  const name = conversation.other.kiotName ?? conversation.other.displayName;
  const incomingRequest = conversation.status === 'request' && !conversation.requestedByMe;

  const append = (incoming: MessageView[]) =>
    setMessages((old) => {
      const ids = new Set(old.map((m) => m.id));
      const next = [...old, ...incoming.filter((m) => !ids.has(m.id))];
      lastId.current = next.at(-1)?.id ?? lastId.current;
      return next;
    });

  // Tin mới của người kia khi đang mở trang: đánh dấu đã đọc và cập nhật số chưa đọc trên thanh dưới.
  const onIncoming = (incoming: MessageView[]) => {
    append(incoming);
    if (incoming.some((m) => m.senderId !== meId) && document.visibilityState === 'visible')
      void markReadAction(conversation.id).then(() => window.dispatchEvent(new Event(ME_CHANGED_EVENT)));
  };

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    let failures = 0;
    const url = () =>
      `/api/hop-thu/events?c=${conversation.id}${lastId.current ? `&after=${lastId.current}` : ''}`;
    const es = new EventSource(url());
    es.addEventListener('messages', (e) => onIncoming(JSON.parse((e as MessageEvent).data) as MessageView[]));
    es.addEventListener('read', (e) =>
      setOtherReadAt((JSON.parse((e as MessageEvent).data) as { at: string | null }).at),
    );
    es.onerror = () => {
      failures += 1;
      if (failures < 3 || poll) return;
      es.close();
      poll = setInterval(async () => {
        const res = await fetch(`${url()}&poll=1`, { cache: 'no-store' }).catch(() => null);
        const data = (await res?.json().catch(() => null)) as {
          messages: MessageView[];
          otherReadAt: string | null;
        } | null;
        if (!data) return;
        onIncoming(data.messages);
        setOtherReadAt(data.otherReadAt);
      }, POLL_MS);
    };
    return () => {
      es.close();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mở một lần cho mỗi cuộc trò chuyện
  }, [conversation.id]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set('file', file);
    const res = await fetch('/api/hop-thu/anh', { method: 'POST', body: form }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as {
      ok: boolean;
      imageId?: string;
      url?: string;
      message?: string;
    } | null;
    setUploading(false);
    if (data?.ok && data.imageId && data.url) setImage({ id: data.imageId, url: data.url });
    else toast(data?.message ?? t('inbox.err.IMAGE_INVALID'));
  }

  const send = () =>
    start(async () => {
      const r = await sendMessageAction(conversation.id, {
        text,
        imageId: image?.id ?? null,
        productId: product?.id ?? null,
      });
      if (!r.ok) return toast(r.message);
      append([r.message]);
      setText('');
      setImage(null);
      setProduct(null);
    });

  const report = (reason: string) =>
    start(async () => {
      setMenu('none');
      toast((await reportAction(conversation.id, reason)).message);
    });

  const lastMine = [...messages].reverse().find((m) => m.senderId === meId);
  const seen = Boolean(lastMine && otherReadAt && otherReadAt >= lastMine.createdAt);
  const sheetBtn = 'block w-full border-b border-black/10 py-3 text-left font-bold';

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] top-16 z-30 flex flex-col bg-ink text-white"
      data-testid="chat-room"
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <Link
          href="/hop-thu"
          aria-label={t('inbox.back')}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-red-500 font-black">
          {name.trim().charAt(0).toUpperCase() || '9'}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-black">{name}</h1>
        <button
          type="button"
          onClick={() => setMenu('menu')}
          aria-label={t('inbox.menu')}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10"
          data-testid="chat-menu"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {incomingRequest ? (
        <div
          className="border-b border-white/10 bg-white/5 px-4 py-3 text-[13px]"
          data-testid="chat-request-banner"
        >
          <p>{t('inbox.request.banner', { name })}</p>
          <div className="mt-2 flex gap-2">
            <form action={acceptAction.bind(null, conversation.id)}>
              <button
                type="submit"
                className="rounded-full bg-brand px-4 py-1.5 font-black"
                data-testid="chat-accept"
              >
                {t('inbox.request.accept')}
              </button>
            </form>
            <form action={deleteConversationAction.bind(null, conversation.id)}>
              <button type="submit" className="rounded-full bg-white/10 px-4 py-1.5 font-bold">
                {t('inbox.request.delete')}
              </button>
            </form>
            <form action={blockAction.bind(null, conversation.other.id)}>
              <button type="submit" className="rounded-full bg-white/10 px-4 py-1.5 font-bold">
                {t('inbox.block')}
              </button>
            </form>
          </div>
        </div>
      ) : conversation.status === 'request' ? (
        <p className="border-b border-white/10 px-4 py-2 text-[12px] text-white/60">
          {t('inbox.request.pending', { name })}
        </p>
      ) : null}

      <div ref={list} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" data-testid="chat-messages">
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div
              key={m.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              data-testid="chat-message"
            >
              <div
                className={`max-w-[78%] rounded-[18px] px-3 py-2 text-[14px] ${
                  mine ? 'rounded-br-[6px] bg-brand text-white' : 'rounded-bl-[6px] bg-white/10'
                }`}
              >
                {m.hidden ? (
                  <i className="text-white/60">{t('inbox.hiddenMsg')}</i>
                ) : (
                  <>
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ảnh riêng tư qua route có kiểm quyền
                      <img src={m.imageUrl} alt="" className="mb-1 max-h-64 rounded-[12px]" loading="lazy" />
                    ) : null}
                    {m.product ? (
                      <a
                        href={m.product.url}
                        className="mb-1 flex items-center gap-2 rounded-[12px] bg-white p-2 text-black"
                        data-testid="chat-product"
                      >
                        <ShoppingBag className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-bold">{m.product.name}</span>
                          <span className="block text-[12px] font-black text-brand">
                            {formatVnd(m.product.price)}
                          </span>
                        </span>
                      </a>
                    ) : null}
                    {m.text ? <p className="whitespace-pre-wrap break-words">{m.text}</p> : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {seen ? (
          <p className="text-right text-[11px] text-white/50" data-testid="chat-seen">
            {t('inbox.seen')}
          </p>
        ) : null}
      </div>

      <form
        className="border-t border-white/10 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {product || image ? (
          <div className="mb-2 flex flex-wrap gap-2 text-[12px]">
            {product ? (
              <span
                className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1"
                data-testid="chat-attach-product"
              >
                {t('inbox.productAttached')}: <b className="max-w-[160px] truncate">{product.name}</b>
                <button type="button" onClick={() => setProduct(null)} aria-label={t('inbox.remove')}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
            {image ? (
              <span className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- xem trước ảnh riêng tư vừa tải */}
                <img src={image.url} alt="" className="h-8 w-8 rounded object-cover" />
                <button type="button" onClick={() => setImage(null)} aria-label={t('inbox.remove')}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <label
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10"
            aria-label={uploading ? t('inbox.uploading') : t('inbox.attachImage')}
          >
            <ImagePlus className="h-5 w-5" aria-hidden />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void pickImage(e.target.files?.[0])}
              data-testid="chat-image-input"
            />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={t('inbox.placeholder')}
            className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] outline-none focus:border-brand"
            data-testid="chat-input"
          />
          <button
            type="submit"
            disabled={pending || uploading || (!text.trim() && !image && !product)}
            aria-label={t('inbox.send')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand disabled:opacity-50"
            data-testid="chat-send"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </form>

      {menu !== 'none' ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60"
          onClick={() => setMenu('none')}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-t-[24px] bg-white p-5 text-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {menu === 'menu' ? (
              <>
                <button
                  type="button"
                  className={sheetBtn}
                  onClick={() => setMenu('report')}
                  data-testid="chat-report"
                >
                  {t('inbox.report')}
                </button>
                <form
                  action={blockAction.bind(null, conversation.other.id)}
                  onSubmit={(e) => {
                    if (!window.confirm(t('inbox.blockConfirm', { name }))) e.preventDefault();
                  }}
                >
                  <button type="submit" className={sheetBtn} data-testid="chat-block">
                    {t('inbox.block')}
                  </button>
                </form>
                <form
                  action={deleteConversationAction.bind(null, conversation.id)}
                  onSubmit={(e) => {
                    if (!window.confirm(t('inbox.deleteConfirm'))) e.preventDefault();
                  }}
                >
                  <button type="submit" className={sheetBtn} data-testid="chat-delete">
                    {t('inbox.delete')}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mb-2 font-display text-[16px] font-bold">{t('inbox.report.title')}</p>
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={sheetBtn}
                    onClick={() => report(r)}
                    data-testid={`chat-report-${r}`}
                  >
                    {t(`inbox.report.${r}`)}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
