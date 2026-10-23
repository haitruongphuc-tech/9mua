import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTimeVN } from '@/lib/format';
import { listNotifications, markAllRead } from '@/lib/notifications';
import { requireUser } from '@/modules/identity';

export const metadata: Metadata = { title: 'Thông báo', robots: { index: false } };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  await markAllRead(user.id);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Thông báo</h1>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Chưa có thông báo.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="notifications">
          {items.map((n) => (
            <li key={n.id} className={`flex flex-col gap-0.5 py-3 ${n.readAt ? '' : 'font-bold'}`}>
              {n.url ? (
                <Link href={n.url} className="underline-offset-2 hover:underline">
                  {n.title}
                </Link>
              ) : (
                <span>{n.title}</span>
              )}
              {n.body ? <span className="text-sm font-normal text-black/70">{n.body}</span> : null}
              <span className="text-xs font-normal text-black/50">{formatDateTimeVN(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
