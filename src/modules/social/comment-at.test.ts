import { describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { addComment, listComments } from './index';

// Bình luận theo phút khi xem tập phim (SPEC-creator.md V5.9 mục 5): lưu atSecond, trả lời thì không có mốc.
describe('bình luận theo phút', () => {
  it('lưu giây đang xem; giá trị lạ hoặc câu trả lời thì bỏ mốc', async () => {
    setClock(new Date('2026-10-30T03:00:00Z'));
    try {
      const owner = await createUser();
      const fan = await createUser();
      const v = await db.video.create({
        data: { authorId: owner.id, status: 'ready', fileUrl: '/uploads/x.mp4', readyAt: now() },
      });
      const a = await addComment(fan.id, v.id, 'Đoạn này hay', null, 75);
      if (!a.ok) throw new Error(a.error);
      advanceClock({ seconds: 11 });
      const b = await addComment(fan.id, v.id, 'Mốc lạ', null, -3);
      advanceClock({ seconds: 11 });
      const c = await addComment(owner.id, v.id, 'Cảm ơn', a.id, 80);
      expect(b.ok && c.ok).toBe(true);
      const list = await listComments(v.id, fan.id);
      const root = list.items.find((x) => x.id === a.id)!;
      expect(root.atSecond).toBe(75);
      expect(root.replies[0]?.atSecond).toBeNull();
      expect(list.items.find((x) => x.text === 'Mốc lạ')?.atSecond).toBeNull();
    } finally {
      resetClock();
    }
  });
});
