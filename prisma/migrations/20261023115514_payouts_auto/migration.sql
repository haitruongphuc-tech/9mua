-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "stuckAlertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertThrottle" (
    "kind" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertThrottle_pkey" PRIMARY KEY ("kind")
);

-- CreateIndex
CREATE INDEX "AlertEvent_kind_sentAt_idx" ON "AlertEvent"("kind", "sentAt");
