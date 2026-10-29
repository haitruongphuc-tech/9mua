// Trang chủ, tab Dành cho bạn: buổi live đang phát ở vị trí thứ 2, sau đó cứ 5 video chèn 1 buổi (SPEC-creator.md
// bổ sung 29/10). Buổi live chỉ được đặt khi đã có video đứng sau nó (hoặc feed đã hết), để video tải thêm luôn nối vào
// cuối và không đẩy buổi live đang xem đi chỗ khác (Safari iPhone kéo khung snap khi phần tử phía trên đổi chỗ).
export type FeedEntry<V, L> = { kind: 'video'; video: V } | { kind: 'live'; live: L };

export function interleaveLives<V, L>(videos: V[], lives: L[], ended: boolean): FeedEntry<V, L>[] {
  const list: FeedEntry<V, L>[] = videos.map((video) => ({ kind: 'video', video }));
  lives.forEach((live, k) => {
    const before = 1 + 5 * k;
    if (videos.length > before || ended)
      list.splice(Math.min(before + k, list.length), 0, { kind: 'live', live });
  });
  return list;
}
