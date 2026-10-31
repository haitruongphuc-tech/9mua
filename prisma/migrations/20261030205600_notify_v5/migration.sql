-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "kind" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOff" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_createdAt_idx" ON "Notification"("userId", "groupKey", "createdAt");

