import { describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import {
  createEvent,
  eventPage,
  remindEvents,
  reportEvent,
  toggleEventInterest,
  upcomingEvents,
} from './events';
import { memoriesOf, setShowMemories } from './memories';

const H = 3_600_000;
const input = (over: Record<string, unknown> = {}) => ({
  title: 'Phiên chợ mực',
  startsAt: new Date(now().getTime() + 3 * H),
  endsAt: new Date(now().getTime() + 5 * H),
  mode: 'place',
  province: 'quang-ninh',
  address: 'Chợ Hạ Long 1',
  description: 'Mực một nắng',
  ...over,
});

describe('sự kiện và kỷ niệm (SPEC-social.md V5.7)', () => {
  it('tạo sự kiện: kiểm tên, giờ, địa điểm, link; tối đa 10 sự kiện sắp diễn ra; lọc theo tỉnh', async () => {
    setClock(new Date('2026-11-01T01:00:00Z'));
    try {
      const u = await createUser();
      expect(await createEvent(u.id, input({ title: '' }))).toEqual({ ok: false, error: 'INVALID' });
      expect(await createEvent(u.id, input({ endsAt: new Date(now().getTime() + H) }))).toEqual({
        ok: false,
        error: 'TIME_INVALID',
      });
      expect(await createEvent(u.id, input({ address: '' }))).toEqual({ ok: false, error: 'PLACE_INVALID' });
      expect(await createEvent(u.id, input({ description: 'xem shop.vn' }))).toEqual({
        ok: false,
        error: 'HAS_LINK',
      });
      const live = await createEvent(u.id, input({ mode: 'live', province: '', address: '' }));
      expect(live.ok).toBe(true);
      for (let i = 0; i < 9; i++)
        expect((await createEvent(u.id, input({ title: `Sự kiện ${i}` }))).ok).toBe(true);
      expect(await createEvent(u.id, input())).toEqual({ ok: false, error: 'LIMIT' });
      const qn = await upcomingEvents(undefined, { province: 'quang-ninh', ownerId: u.id });
      expect(qn).toHaveLength(9);
    } finally {
      resetClock();
    }
  });

  it('quan tâm → thông báo 1 giờ trước giờ bắt đầu, chỉ một lần; 5 báo cáo thì tự ẩn', async () => {
    setClock(new Date('2026-11-02T01:00:00Z'));
    try {
      const owner = await createUser();
      const fan = await createUser();
      const r = await createEvent(owner.id, input());
      if (!r.ok) throw new Error(r.error);
      expect(await toggleEventInterest(fan.id, r.eventId)).toEqual({ ok: true, interested: true });
      expect(await remindEvents()).toBe(0); // còn 3 giờ
      advanceClock({ hours: 2, minutes: 5 });
      expect(await remindEvents()).toBe(1);
      expect(await remindEvents()).toBe(0);
      expect(await db.notification.count({ where: { userId: fan.id, title: '@notify.eventSoon' } })).toBe(1);
      expect((await eventPage(r.eventId, fan.id))?.interestedByMe).toBe(true);
      for (let i = 0; i < 5; i++) await reportEvent((await createUser()).id, r.eventId, 'khac');
      expect((await db.event.findUniqueOrThrow({ where: { id: r.eventId } })).status).toBe('removed');
      expect(await eventPage(r.eventId, fan.id)).toBeNull();
    } finally {
      resetClock();
    }
  });

  it('kỷ niệm: video cùng ngày tháng các năm trước, chỉ của mình; tắt được', async () => {
    setClock(new Date('2026-11-03T05:00:00Z'));
    try {
      const u = await createUser();
      const lastYear = new Date('2025-11-03T03:00:00Z');
      const v = await db.video.create({
        data: { authorId: u.id, status: 'ready', fileUrl: '/x.mp4', readyAt: lastYear, createdAt: lastYear },
      });
      await db.video.create({
        data: {
          authorId: u.id,
          status: 'ready',
          fileUrl: '/y.mp4',
          createdAt: new Date('2025-11-04T03:00:00Z'),
        },
      });
      expect((await memoriesOf(u.id))?.videos.map((x) => x.id)).toEqual([v.id]);
      await setShowMemories(u.id, false);
      expect(await memoriesOf(u.id)).toBeNull();
    } finally {
      resetClock();
    }
  });
});
