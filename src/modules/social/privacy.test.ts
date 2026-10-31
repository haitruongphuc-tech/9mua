import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { canViewVideo, getCreatorProfile, getFeed } from '@/modules/creator';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { followStats, toggleFollow } from './follow';
import { canSeeProfileContent, followRequests, respondFollowRequest, setPrivateAccount } from './privacy';

async function publicVideo(authorId: string) {
  return db.video.create({
    data: {
      authorId,
      caption: 'Video riêng tư thử',
      status: 'ready',
      fileUrl: '/uploads/videos/rieng-tu.mp4',
      readyAt: new Date(),
    },
  });
}

describe('tài khoản riêng tư (SPEC-identity.md V5.2)', () => {
  it('follow thành yêu cầu; chấp nhận mới xem được; video public hiển thị như followers và rời feed', async () => {
    const [owner, fan, stranger] = [await createUser(), await createUser(), await createUser()];
    const v = await publicVideo(owner.id);
    expect(await setPrivateAccount(owner.id, true)).toEqual({ ok: true });

    expect(await canViewVideo(v.id, stranger.id)).toBe(false);
    expect(await canViewVideo(v.id, undefined)).toBe(false);
    expect(await canViewVideo(v.id, owner.id)).toBe(true);
    expect((await getFeed({ anonId: 'anon-rieng-tu-aaaaaaa' })).items.map((x) => x.id)).not.toContain(v.id);
    expect((await getCreatorProfile(owner.id, stranger.id))?.videos).toHaveLength(0);
    expect(await canSeeProfileContent(owner.id, stranger.id)).toBe(false);

    const r = await toggleFollow(fan.id, owner.id);
    expect(r).toMatchObject({ ok: true, following: false, requested: true });
    expect((await followStats(owner.id)).followers).toBe(0);
    expect((await followRequests(owner.id)).map((x) => x.userId)).toEqual([fan.id]);
    expect(await respondFollowRequest(stranger.id, fan.id, true)).toBe(false);
    expect(await respondFollowRequest(owner.id, fan.id, true)).toBe(true);
    expect((await followStats(owner.id, fan.id)).isFollowing).toBe(true);
    expect(await canViewVideo(v.id, fan.id)).toBe(true);
    expect(await canSeeProfileContent(owner.id, fan.id)).toBe(true);
    expect((await getCreatorProfile(owner.id, fan.id))?.videos).toHaveLength(1);

    // Bấm lần nữa khi đang chờ là huỷ yêu cầu.
    expect(await toggleFollow(stranger.id, owner.id)).toMatchObject({ requested: true });
    expect(await toggleFollow(stranger.id, owner.id)).toMatchObject({ requested: false });
    expect(await followRequests(owner.id)).toHaveLength(0);

    // Tắt riêng tư: trở lại như cũ, yêu cầu đang chờ được chấp nhận.
    await toggleFollow(stranger.id, owner.id);
    expect(await setPrivateAccount(owner.id, false)).toEqual({ ok: true });
    expect((await followStats(owner.id, stranger.id)).isFollowing).toBe(true);
    expect(await canViewVideo(v.id, undefined)).toBe(true);
  });

  it('chủ Kiot đang hoạt động không bật riêng tư được', async () => {
    const seller = await createSeller({ active: true });
    expect(await setPrivateAccount(seller.user.id, true)).toEqual({ ok: false, error: 'KIOT_ACTIVE' });
    const draft = await createSeller();
    expect(await setPrivateAccount(draft.user.id, true)).toEqual({ ok: true });
  });
});
