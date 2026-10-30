import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { getVideo } from './feed';
import { processNextJob } from './jobs';
import { createVideoUpload, saveUpload } from './upload';

// Trả lời bình luận bằng video (SPEC-creator.md V5.8).
describe('trả lời bình luận bằng video', () => {
  it(
    'chỉ chủ video trả lời được; thẻ bình luận hiện trên video; bình luận bị ẩn thì "không còn"',
    { timeout: 60_000 },
    async () => {
      const owner = await createUser();
      const fan = await createUser({ displayName: 'Người hỏi' });
      const v = await db.video.create({
        data: { authorId: owner.id, status: 'ready', fileUrl: '/uploads/x.mp4', readyAt: now() },
      });
      const c = await db.comment.create({
        data: { videoId: v.id, userId: fan.id, text: 'Giá bao nhiêu shop?', createdAt: now() },
      });
      const upload = async (userId: string) => {
        const saved = await saveUpload(userId, createReadStream('tests/fixtures/videos/landscape.mp4'));
        if (!saved.ok) throw new Error(saved.error);
        return saved.uploadId;
      };
      expect(
        await createVideoUpload(fan.id, await upload(fan.id), {
          caption: 'x',
          productIds: [],
          options: { replyTo: { commentId: c.id, x: 0.5, y: 0.2 } },
        }),
      ).toEqual({ ok: false, error: 'REPLY_INVALID' });
      const r = await createVideoUpload(owner.id, await upload(owner.id), {
        caption: 'Trả lời: 150k',
        productIds: [],
        options: { replyTo: { commentId: c.id, x: 0.3, y: 0.7 } },
      });
      if (!r.ok) throw new Error(r.error);
      expect((await db.comment.findUniqueOrThrow({ where: { id: c.id } })).replyVideoId).toBe(r.videoId);
      expect(await processNextJob()).toBe(true);
      expect((await getVideo(r.videoId, {}))?.replyTo).toMatchObject({
        text: 'Giá bao nhiêu shop?',
        authorName: 'Người hỏi',
        x: 0.3,
        y: 0.7,
      });
      // Đã trả lời rồi thì không trả lời lần nữa.
      expect(
        await createVideoUpload(owner.id, await upload(owner.id), {
          caption: 'lần 2',
          productIds: [],
          options: { replyTo: { commentId: c.id, x: 0.5, y: 0.5 } },
        }),
      ).toEqual({ ok: false, error: 'REPLY_INVALID' });
      await db.comment.update({ where: { id: c.id }, data: { hiddenAt: now() } });
      expect((await getVideo(r.videoId, {}))?.replyTo?.text).toBeNull();
    },
  );
});
