-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "sourceLiveId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sourceLiveId" TEXT;

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "kiotId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "mediaPath" TEXT NOT NULL,
    "publishTokenHash" TEXT NOT NULL,
    "publishExpiresAt" TIMESTAMP(3) NOT NULL,
    "publishUsedAt" TIMESTAMP(3),
    "pinnedProductId" TEXT,
    "startedAt" TIMESTAMP(3),
    "lastMediaAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "peakViewers" INTEGER NOT NULL DEFAULT 0,
    "hearts" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveViewer" (
    "liveId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "userId" TEXT,
    "networkHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "streakStartAt" TIMESTAMP(3) NOT NULL,
    "longestStreakSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveViewer_pkey" PRIMARY KEY ("liveId","viewerKey")
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveChatBan" (
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveChatBan_pkey" PRIMARY KEY ("liveId","userId")
);

-- CreateTable
CREATE TABLE "LiveReport" (
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveReport_pkey" PRIMARY KEY ("liveId","userId")
);

-- CreateTable
CREATE TABLE "LiveBan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XuEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "liveId" TEXT,
    "rewardDay" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XuEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_mediaPath_key" ON "LiveSession"("mediaPath");

-- CreateIndex
CREATE INDEX "LiveSession_status_createdAt_idx" ON "LiveSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LiveSession_hostUserId_createdAt_idx" ON "LiveSession"("hostUserId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveViewer_liveId_lastSeenAt_idx" ON "LiveViewer"("liveId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_liveId_createdAt_idx" ON "LiveChatMessage"("liveId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveChatMessage_createdAt_idx" ON "LiveChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "LiveBan_userId_createdAt_idx" ON "LiveBan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XuEntry_userId_createdAt_idx" ON "XuEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XuEntry_createdAt_idx" ON "XuEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XuEntry_userId_rewardDay_key" ON "XuEntry"("userId", "rewardDay");

-- CreateIndex
CREATE INDEX "OrderItem_sourceLiveId_idx" ON "OrderItem"("sourceLiveId");

-- Viết tay: sổ xu chỉ thêm (SPEC-live.md phần 2), giống sổ tiền.
CREATE TRIGGER "XuEntry_append_only" BEFORE UPDATE OR DELETE ON "XuEntry"
  FOR EACH ROW EXECUTE FUNCTION append_only();
ALTER TABLE "XuEntry" ADD CONSTRAINT "XuEntry_kind_valid" CHECK ("kind" IN ('live_reward', 'admin_revoke'));
ALTER TABLE "XuEntry" ADD CONSTRAINT "XuEntry_sign" CHECK (
  ("kind" = 'live_reward' AND "amount" > 0 AND "rewardDay" IS NOT NULL) OR ("kind" = 'admin_revoke' AND "amount" < 0)
);
-- Mỗi tài khoản chỉ 1 buổi live đang mở (created/live) tại một thời điểm.
CREATE UNIQUE INDEX "LiveSession_one_open_per_host" ON "LiveSession"("hostUserId") WHERE "status" IN ('created', 'live');
