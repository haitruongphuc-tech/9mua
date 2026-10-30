import { describe, expect, it } from 'vitest';
import { now, resetClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';
import { getMessages, listConversations, openConversation, sendMessage } from './index';

async function oldUser(displayName?: string) {
  const u = await createUser({ displayName });
  await db.user.update({
    where: { id: u.id },
    data: { createdAt: new Date(now().getTime() - 10 * 86_400_000) },
  });
  return u;
}

const video = (authorId: string, visibility = 'public') =>
  db.video.create({
    data: {
      authorId,
      status: 'ready',
      visibility,
      caption: `Video ${visibility}`,
      fileUrl: '/uploads/x.mp4',
      posterUrl: '/uploads/x.jpg',
      readyAt: now(),
    },
  });

// Gửi video qua Hộp thư (SPEC-messages.md V5.1): thẻ video theo quyền xem của người nhận.
describe('gửi video qua Hộp thư', () => {
  it('gửi thẻ video kèm lời nhắn; người nhận không được xem thì thẻ ghi "không còn xem được"', async () => {
    resetClock();
    const creator = await oldUser('Người quay');
    const a = await oldUser();
    const b = await oldUser();
    const pub = await video(creator.id);
    const priv = await video(creator.id, 'private');
    const opened = await openConversation(a.id, b.id);
    if (!opened.ok) throw new Error(opened.error);
    const c = opened.conversationId;

    // Không gửi video mình không được xem.
    expect(await sendMessage(a.id, c, { videoId: priv.id })).toEqual({ ok: false, error: 'VIDEO_INVALID' });
    const sent = await sendMessage(a.id, c, { videoId: pub.id, text: 'Xem cái này' });
    if (!sent.ok) throw new Error(sent.error);
    expect(sent.message.video).toMatchObject({ id: pub.id, available: true, authorName: 'Người quay' });
    expect((await listConversations(a.id, 'inbox'))[0]?.last).toMatchObject({ kind: 'text', fromMe: true });

    // Chủ video chuyển sang riêng tư sau khi gửi: người nhận thấy thẻ "không còn xem được".
    await db.video.update({ where: { id: pub.id }, data: { visibility: 'private' } });
    const seen = await getMessages(b.id, c);
    expect(seen?.at(-1)?.video).toMatchObject({ id: pub.id, available: false, caption: '' });
    expect(seen?.at(-1)?.text).toBe('Xem cái này');
  });
});
