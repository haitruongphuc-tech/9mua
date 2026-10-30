// Trang chủ, tab Dành cho bạn: buổi live đang phát ở vị trí thứ 2, sau đó cứ 5 video chèn 1 buổi (SPEC-creator.md
// bổ sung 29/10). Buổi live chỉ được đặt khi đã có video đứng sau nó (hoặc feed đã hết), để video tải thêm luôn nối vào
// cuối và không đẩy buổi live đang xem đi chỗ khác (Safari iPhone kéo khung snap khi phần tử phía trên đổi chỗ).
// P: bài viết (V5.10); không truyền thì không có loại 'post'.
export type FeedEntry<V, L, P = never> =
  | { kind: 'video'; video: V }
  | { kind: 'live'; live: L }
  | ([P] extends [never] ? never : { kind: 'post'; post: P });

export function interleaveLives<V, L>(videos: V[], lives: L[], ended: boolean): FeedEntry<V, L>[] {
  const list: FeedEntry<V, L>[] = videos.map((video) => ({ kind: 'video', video }));
  lives.forEach((live, k) => {
    const before = 1 + 5 * k;
    if (videos.length > before || ended)
      list.splice(Math.min(before + k, list.length), 0, { kind: 'live', live });
  });
  return list;
}

// Bài viết ảnh + chữ (SPEC-creator.md V5.10): bài đầu sau video thứ 4, sau đó cứ 6 video chèn 1 bài; cùng luật chỉ đặt khi
// đã có video đứng sau. Feed đã hết thì bài còn lại nối vào cuối.
export function interleavePosts<V, L, P>(
  entries: FeedEntry<V, L>[],
  posts: P[],
  ended: boolean,
): FeedEntry<V, L, P>[] {
  const list: FeedEntry<V, L, P>[] = [...entries];
  let k = 0;
  let videos = 0;
  for (let i = 0; i < list.length && k < posts.length; i++) {
    if (list[i]!.kind !== 'video') continue;
    videos += 1;
    if (videos === 4 + 6 * k && (i < list.length - 1 || ended)) {
      list.splice(i + 1, 0, { kind: 'post', post: posts[k]! } as FeedEntry<V, L, P>);
      k += 1;
      i += 1;
    }
  }
  if (ended) while (k < posts.length) list.push({ kind: 'post', post: posts[k++]! } as FeedEntry<V, L, P>);
  return list;
}
