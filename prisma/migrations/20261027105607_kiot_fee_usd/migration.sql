-- CreateTable
CREATE TABLE "KiotFeeRateLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "usdCents" INTEGER NOT NULL,
    "oldFeeVnd" INTEGER NOT NULL,
    "newFeeVnd" INTEGER NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KiotFeeRateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KiotFeeRateLog_createdAt_idx" ON "KiotFeeRateLog"("createdAt");

-- Viết tay: sổ đổi giá chỉ thêm, số không âm.
ALTER TABLE "KiotFeeRateLog" ADD CONSTRAINT "KiotFeeRateLog_values_positive"
  CHECK ("rate" > 0 AND "usdCents" > 0 AND "oldFeeVnd" >= 0 AND "newFeeVnd" >= 0);
CREATE TRIGGER "KiotFeeRateLog_append_only" BEFORE UPDATE OR DELETE ON "KiotFeeRateLog"
  FOR EACH ROW EXECUTE FUNCTION append_only();
