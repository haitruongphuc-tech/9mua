import { Bell } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import type { MessageKey } from '@/i18n/messages';
import { formatDateTime } from '@/lib/format';
import { listNotifications, markAllRead } from '@/lib/notifications';
import { requireUser } from '@/modules/identity';

export const metadata: Metadata = { title: 'Thông báo', robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser();
  const [items, t] = await Promise.all([listNotifications(user.id), getT()]);
  await markAllRead(user.id);
  // Thông báo lưu theo khoá từ điển ("@notify.xxx", biến trong body) hiện đúng ngôn ngữ đang chọn; biến "detail" là
  // dòng phụ (chú thích video, lý do). Thông báo cũ lưu chữ thường vẫn hiện như cũ.
  const text = (n: (typeof items)[number]) => {
    if (!n.title.startsWith('@')) return { title: n.title, body: n.body };
    let vars: Record<string, string | number> = {};
    try {
      vars = JSON.parse(n.body) as typeof vars;
    } catch {}
    const detail = vars.detail ? String(vars.detail) : '';
    return {
      title: t(n.title.slice(1) as MessageKey, vars),
      body: detail && n.title === '@notify.videoRemoved' ? t('notify.reason', { reason: detail }) : detail,
    };
  };
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('notify.title')}</h1>
      {items.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('notify.empty')}
        </p>
      ) : (
        <ul
          className="flex flex-col divide-y divide-white/10 rounded-[18px] border border-white/10 bg-white/5"
          data-testid="notifications"
        >
          {items.map((n) => {
            const { title, body } = text(n);
            return (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.readAt ? 'bg-white/10' : 'bg-brand'}`}
                >
                  <Bell className="h-4 w-4" aria-hidden />
                </span>
                <span className={`flex min-w-0 flex-col gap-0.5 ${n.readAt ? '' : 'font-bold'}`}>
                  {n.url ? (
                    <Link href={n.url} className="text-[14px] underline-offset-2 hover:underline">
                      {title}
                    </Link>
                  ) : (
                    <span className="text-[14px]">{title}</span>
                  )}
                  {body ? <span className="text-[13px] font-normal text-white/60">{body}</span> : null}
                  <span className="text-[11px] font-normal text-white/40">
                    {formatDateTime(n.createdAt, t.lang)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
