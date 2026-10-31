import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { canViewPost } from '@/modules/creator';
import { createUser } from '../../../tests/helpers/factories';
import {
  approveMember,
  banMember,
  createGroup,
  groupFeed,
  joinGroup,
  listGroupReports,
  moderateGroupPost,
  postToGroup,
  reportGroup,
  resolveGroupReports,
  setApprovePosts,
  setGroupAdmin,
  groupPage,
} from './groups';

const DAY = 86_400_000;
const later = () => setClock(new Date(Date.now() + 8 * DAY));

describe('nhóm cộng đồng (SPEC-social.md V5.10)', () => {
  it('tạo nhóm: tài khoản ≥ 7 ngày, tên hợp lệ, tối đa 5 nhóm', async () => {
    const u = await createUser();
    expect(await createGroup(u.id, { name: 'Hội mực', privacy: 'public' })).toEqual({
      ok: false,
      error: 'TOO_NEW',
    });
    later();
    try {
      expect(await createGroup(u.id, { name: '', privacy: 'public' })).toEqual({
        ok: false,
        error: 'INVALID',
      });
      expect(await createGroup(u.id, { name: 'Hội', privacy: 'secret' })).toEqual({
        ok: false,
        error: 'INVALID',
      });
      expect(await createGroup(u.id, { name: 'Vào shop.vn', privacy: 'public' })).toEqual({
        ok: false,
        error: 'HAS_LINK',
      });
      for (let i = 0; i < 5; i += 1)
        expect((await createGroup(u.id, { name: `Nhóm ${i}`, privacy: 'public' })).ok).toBe(true);
      expect(await createGroup(u.id, { name: 'Nhóm 6', privacy: 'public' })).toEqual({
        ok: false,
        error: 'LIMIT',
      });
    } finally {
      resetClock();
    }
  });

  it('nhóm riêng tư: người ngoài không thấy bài; vào phải được duyệt; bị cấm không đăng được', async () => {
    const [owner, fan, outsider] = [await createUser(), await createUser(), await createUser()];
    later();
    try {
      const g = await createGroup(owner.id, { name: 'Hội kín', privacy: 'private' });
      if (!g.ok) throw new Error('tạo nhóm lỗi');
      const p = await postToGroup(owner.id, g.groupId, { text: 'Bài cho thành viên' });
      if (!p.ok) throw new Error('đăng lỗi');
      expect(p.status).toBe('published');

      expect(await groupFeed(g.groupId, outsider.id)).toBeNull();
      const postId = (await groupFeed(g.groupId, owner.id))![0]!.post!.id;
      expect(await canViewPost(postId, outsider.id)).toBe(false);
      expect(await canViewPost(postId, undefined)).toBe(false);

      expect(await joinGroup(fan.id, g.groupId)).toEqual({ ok: true, status: 'pending' });
      expect(await groupFeed(g.groupId, fan.id)).toBeNull();
      expect(await postToGroup(fan.id, g.groupId, { text: 'chưa được' })).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await approveMember(outsider.id, g.groupId, fan.id, true)).toBe(false);
      expect(await approveMember(owner.id, g.groupId, fan.id, true)).toBe(true);
      expect((await groupPage(g.groupId, fan.id))?.memberCount).toBe(2);
      expect(await groupFeed(g.groupId, fan.id)).toHaveLength(1);
      expect(await canViewPost(postId, fan.id)).toBe(true);

      expect(await banMember(owner.id, g.groupId, fan.id)).toBe(true);
      expect(await postToGroup(fan.id, g.groupId, { text: 'bị cấm' })).toEqual({
        ok: false,
        error: 'BANNED',
      });
      expect(await joinGroup(fan.id, g.groupId)).toEqual({ ok: false, error: 'BANNED' });
      expect(await canViewPost(postId, fan.id)).toBe(false);
      expect((await groupPage(g.groupId, fan.id))?.memberCount).toBe(1);
    } finally {
      resetClock();
    }
  });

  it('nhóm công khai: vào thẳng, duyệt bài, tối đa 3 quản trị viên, CEO khoá nhóm', async () => {
    const owner = await createUser();
    const members = [
      await createUser(),
      await createUser(),
      await createUser(),
      await createUser(),
      await createUser(),
    ];
    const outsider = await createUser();
    later();
    try {
      const g = await createGroup(owner.id, { name: 'Hội chợ', privacy: 'public' });
      if (!g.ok) throw new Error('tạo nhóm lỗi');
      for (const m of members)
        expect(await joinGroup(m.id, g.groupId)).toEqual({ ok: true, status: 'active' });
      for (const m of members.slice(0, 3))
        expect(await setGroupAdmin(owner.id, g.groupId, m.id, true)).toEqual({ ok: true });
      expect(await setGroupAdmin(owner.id, g.groupId, members[3]!.id, true)).toEqual({
        ok: false,
        error: 'ADMIN_LIMIT',
      });
      expect(await setGroupAdmin(members[0]!.id, g.groupId, members[3]!.id, true)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });

      expect(await setApprovePosts(members[4]!.id, g.groupId, true)).toBe(false);
      expect(await setApprovePosts(members[0]!.id, g.groupId, true)).toBe(true);
      const p = await postToGroup(members[4]!.id, g.groupId, { text: 'Chờ duyệt' });
      if (!p.ok) throw new Error('đăng lỗi');
      expect(p.status).toBe('pending');
      expect(await groupFeed(g.groupId, outsider.id)).toHaveLength(0);
      expect(await moderateGroupPost(members[4]!.id, p.id, 'approve')).toBe(false);
      expect(await moderateGroupPost(members[1]!.id, p.id, 'approve')).toBe(true);
      const feed = await groupFeed(g.groupId, outsider.id);
      expect(feed).toHaveLength(1);
      expect(await canViewPost(feed![0]!.post!.id, outsider.id)).toBe(true);

      expect(await reportGroup(outsider.id, g.groupId, 'scam')).toBe(true);
      expect(await reportGroup(outsider.id, g.groupId, 'scam')).toBe(true);
      expect((await listGroupReports()).find((r) => r.group?.id === g.groupId)?.count).toBe(1);
      expect(await resolveGroupReports(g.groupId, 'lock', 'Lừa đảo')).toBe(true);
      expect(await groupFeed(g.groupId, owner.id)).toBeNull();
      expect(await canViewPost(feed![0]!.post!.id, outsider.id)).toBe(false);
      expect(await joinGroup(outsider.id, g.groupId)).toEqual({ ok: false, error: 'NOT_FOUND' });
      expect((await groupPage(g.groupId, owner.id))?.lockReason).toBe('Lừa đảo');
    } finally {
      resetClock();
    }
  });
});
