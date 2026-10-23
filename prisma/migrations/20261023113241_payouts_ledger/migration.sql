-- CreateTable
CREATE TABLE "BalanceEntry" (
    "id" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "orderId" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE INDEX "BalanceEntry_kiotId_createdAt_idx" ON "BalanceEntry"("kiotId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceEntry_type_refId_key" ON "BalanceEntry"("type", "refId");

-- CreateIndex
CREATE INDEX "PlatformRevenue_createdAt_idx" ON "PlatformRevenue"("createdAt");

CREATE TRIGGER balance_entry_append_only BEFORE UPDATE OR DELETE ON "BalanceEntry" FOR EACH ROW EXECUTE FUNCTION append_only();
CREATE TRIGGER platform_revenue_append_only BEFORE UPDATE OR DELETE ON "PlatformRevenue" FOR EACH ROW EXECUTE FUNCTION append_only();
ALTER TABLE "PlatformRevenue" ADD CONSTRAINT "PlatformRevenue_fee_nonnegative" CHECK ("fee" >= 0);
