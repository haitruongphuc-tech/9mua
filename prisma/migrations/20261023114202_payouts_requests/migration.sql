-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "bankBin" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT,
    "autoRuleReasons" JSONB NOT NULL DEFAULT '[]',
    "payosPayoutId" TEXT,
    "payosState" TEXT,
    "bankRef" TEXT,
    "receiverNameFromBank" TEXT,
    "rejectReason" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_code_key" ON "PayoutRequest"("code");

-- CreateIndex
CREATE INDEX "PayoutRequest_kiotId_createdAt_idx" ON "PayoutRequest"("kiotId", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");

CREATE SEQUENCE payout_code_seq START WITH 100000;
-- Mỗi Kiot tối đa 1 yêu cầu rút đang chờ/đang xử lý (chốt chặn cuối ở DB, kể cả khi code có lỗi).
CREATE UNIQUE INDEX "PayoutRequest_one_open_per_kiot" ON "PayoutRequest" ("kiotId") WHERE status IN ('pending', 'processing');
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_amounts_valid" CHECK (amount > 0 AND fee >= 0 AND "netAmount" = amount - fee AND "netAmount" > 0);
