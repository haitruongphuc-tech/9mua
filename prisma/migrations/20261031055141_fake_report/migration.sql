-- CreateTable
CREATE TABLE "FakeReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "orderId" TEXT,
    "reason" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'open',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "sellerResponse" TEXT,
    "sellerImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sellerRespondedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FakeReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FakeReport_status_deadlineAt_idx" ON "FakeReport"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "FakeReport_kiotId_createdAt_idx" ON "FakeReport"("kiotId", "createdAt");

-- CreateIndex
CREATE INDEX "FakeReport_reporterId_status_resolvedAt_idx" ON "FakeReport"("reporterId", "status", "resolvedAt");

