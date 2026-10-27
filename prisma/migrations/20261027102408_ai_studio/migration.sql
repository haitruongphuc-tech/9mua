-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "images" INTEGER,
    "costVnd" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSlideshow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'queued',
    "url" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSlideshow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_userId_kind_createdAt_idx" ON "AiUsage"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiImage_userId_createdAt_idx" ON "AiImage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiImage_createdAt_idx" ON "AiImage"("createdAt");

-- CreateIndex
CREATE INDEX "AiSlideshow_userId_createdAt_idx" ON "AiSlideshow"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSlideshow_status_createdAt_idx" ON "AiSlideshow"("status", "createdAt");

-- Viết tay (Prisma không quản lý): sổ chi phí AI chỉ thêm, số tiền không âm.
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_cost_nonnegative" CHECK ("costVnd" >= 0);
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_kind_valid" CHECK ("kind" IN ('text', 'image'));
CREATE TRIGGER "AiUsage_append_only" BEFORE UPDATE OR DELETE ON "AiUsage"
  FOR EACH ROW EXECUTE FUNCTION append_only();
