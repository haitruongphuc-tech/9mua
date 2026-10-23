// Điểm feed (SPEC-creator.md mục 3): (thích × 3 + lượt xem đủ ≥ 50%) giảm dần theo tuổi (giờ + 2)^1.5.
// Cộng thêm 1 để video mới chưa có tương tác vẫn có điểm > 0.
export function feedScore(input: { likes: number; qualifiedViews: number; ageHours: number }): number {
  return (input.likes * 3 + input.qualifiedViews + 1) / Math.pow(Math.max(input.ageHours, 0) + 2, 1.5);
}

export function initialScore(): number {
  return feedScore({ likes: 0, qualifiedViews: 0, ageHours: 0 });
}
