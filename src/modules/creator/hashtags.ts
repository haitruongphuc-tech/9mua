// Tách hashtag từ chú thích: "#ThanhLòng #thanh_long" → ["thanhlong", "thanh_long"] (bỏ dấu, chữ thường).
export function extractHashtags(caption: string): string[] {
  const tags = [...caption.matchAll(/#([\p{L}\p{N}_]{1,50})/gu)].map((m) =>
    m[1]!.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(),
  );
  return [...new Set(tags)].slice(0, 10);
}
