import { describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setNotifyTypes } from '@/lib/notify-events';
import { createUser } from '../../../tests/helpers/factories';
import { toggleFollow } from './follow';
import { heartVideo } from './hearts';

const old = async (displayName: string) => {
  const u = await createUser({ displayName });
  return db.user.update({
    where: { id: u.id },
    data: { createdAt: new Date(now().getTime() - 10 * 86_400_000) },
  });
};

// Thông báo mới (SPEC-social.md V5.5): follow mới và lượt thích cùng video gộp theo giờ; tắt được từng loại.
describe('thông báo mới', () => {
  it('follow mới gộp trong 1 giờ: "A và 2 người khác đã follow bạn"; sang giờ sau thành thông báo mới', async () => {
    setClock(new Date('2026-10-30T08:00:00Z'));
    try {
      const me = await createUser();
      for (const name of ['Như Huỳnh', 'Bảo', 'Châu']) await toggleFollow((await old(name)).id, me.id);
      const list = await db.notification.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ title: '@notify.newFollowers', count: 3, kind: 'follow' });
      expect(JSON.parse(list[0]!.body)).toEqual({ name: 'Châu', others: 2 });
      advanceClock({ hours: 2 });
      await toggleFollow((await old('Dung')).id, me.id);
      expect(await db.notification.count({ where: { userId: me.id } })).toBe(2);
    } finally {
      resetClock();
    }
  });

  it('thích video: mỗi video tối đa 1 thông báo mỗi giờ; tắt loại "thích" thì không nhận', async () => {
    setClock(new Date('2026-10-30T09:00:00Z'));
    try {
      const author = await createUser();
      const v = await db.video.create({
        data: { authorId: author.id, status: 'ready', fileUrl: '/uploads/x.mp4', readyAt: now() },
      });
      for (const name of ['Anh', 'Bảo']) await heartVideo((await old(name)).id, v.id, 'toggle');
      const n = await db.notification.findMany({ where: { userId: author.id } });
      expect(n).toHaveLength(1);
      expect(n[0]).toMatchObject({ title: '@notify.videoLikedMany', count: 2 });
      await setNotifyTypes(author.id, ['follow']); // tắt "thích"
      const v2 = await db.video.create({
        data: { authorId: author.id, status: 'ready', fileUrl: '/uploads/y.mp4', readyAt: now() },
      });
      await heartVideo((await old('Cúc')).id, v2.id, 'toggle');
      expect(await db.notification.count({ where: { userId: author.id } })).toBe(1);
    } finally {
      resetClock();
    }
  });
});
