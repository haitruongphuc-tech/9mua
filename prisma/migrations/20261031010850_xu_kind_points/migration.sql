-- Đổi điểm ra xu (SPEC-social.md V5.6): nới ràng buộc loại dòng XuEntry, chỉ thêm loại mới, không đụng dữ liệu cũ.
ALTER TABLE "XuEntry" DROP CONSTRAINT "XuEntry_kind_valid";
ALTER TABLE "XuEntry" ADD CONSTRAINT "XuEntry_kind_valid" CHECK ("kind" IN ('live_reward', 'admin_revoke', 'points_exchange'));
ALTER TABLE "XuEntry" DROP CONSTRAINT "XuEntry_sign";
ALTER TABLE "XuEntry" ADD CONSTRAINT "XuEntry_sign" CHECK (
  ("kind" = 'live_reward' AND "amount" > 0 AND "rewardDay" IS NOT NULL) OR ("kind" = 'admin_revoke' AND "amount" < 0)
  OR ("kind" = 'points_exchange' AND "amount" > 0 AND "refId" IS NOT NULL)
);
