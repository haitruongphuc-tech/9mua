import { describe, expect, it } from 'vitest';
import { interleaveLives, interleavePosts } from './interleave';

const kinds = (list: ReturnType<typeof interleaveLives<number, string>>) =>
  list.map((e) => (e.kind === 'video' ? `v${e.video}` : `L${e.live}`)).join(' ');

describe('chèn live vào feed trang chủ (SPEC-creator.md bổ sung 29/10)', () => {
  it('live ở vị trí thứ 2, sau đó cứ 5 video 1 buổi', () => {
    const v = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(kinds(interleaveLives(v, ['a', 'b', 'c'], false))).toBe(
      'v1 La v2 v3 v4 v5 v6 Lb v7 v8 v9 v10 v11 Lc v12',
    );
  });

  it('chưa có video đứng sau thì chờ; feed đã hết thì đặt ở cuối', () => {
    expect(kinds(interleaveLives([1, 2, 3], ['a', 'b'], false))).toBe('v1 La v2 v3');
    expect(kinds(interleaveLives([1, 2, 3], ['a', 'b'], true))).toBe('v1 La v2 v3 Lb');
    expect(kinds(interleaveLives([], ['a'], true))).toBe('La');
    expect(kinds(interleaveLives([1], ['a'], false))).toBe('v1');
  });

  it('nối thêm video không làm buổi live đã đặt đổi chỗ', () => {
    const before = interleaveLives([1, 2, 3, 4, 5, 6, 7], ['a', 'b'], false);
    const after = interleaveLives([1, 2, 3, 4, 5, 6, 7, 8, 9], ['a', 'b'], false);
    const pos = (list: typeof before, id: string) =>
      list.findIndex((e) => e.kind === 'live' && e.live === id);
    expect(pos(after, 'a')).toBe(pos(before, 'a'));
    expect(pos(after, 'b')).toBe(pos(before, 'b'));
  });
});

describe('chèn bài viết vào feed trang chủ (SPEC-creator.md V5.10)', () => {
  const show = (list: ReturnType<typeof interleavePosts<number, string, string>>) =>
    list
      .map((e) => (e.kind === 'video' ? `v${e.video}` : e.kind === 'live' ? `L${e.live}` : `P${e.post}`))
      .join(' ');
  it('bài đầu sau video thứ 4, sau đó cứ 6 video 1 bài; live không tính là video', () => {
    const v = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(show(interleavePosts(interleaveLives(v, ['a'], false), ['x', 'y', 'z'], false))).toBe(
      'v1 La v2 v3 v4 Px v5 v6 v7 v8 v9 v10 Py v11 v12',
    );
  });
  it('feed đã hết thì bài còn lại nối vào cuối; chưa hết thì không đặt bài sau video cuối', () => {
    expect(show(interleavePosts(interleaveLives([1, 2, 3, 4], [], false), ['x'], false))).toBe('v1 v2 v3 v4');
    expect(show(interleavePosts(interleaveLives([1, 2], [], true), ['x', 'y'], true))).toBe('v1 v2 Px Py');
  });
});
