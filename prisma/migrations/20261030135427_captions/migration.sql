-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "wantCaptions" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VideoCaption" (
    "videoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "vtt" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCaption_pkey" PRIMARY KEY ("videoId")
);

-- CreateTable
CREATE TABLE "SttUsage" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "costVnd" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SttUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoCaption_status_createdAt_idx" ON "VideoCaption"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SttUsage_createdAt_idx" ON "SttUsage"("createdAt");

-- AddForeignKey
ALTER TABLE "VideoCaption" ADD CONSTRAINT "VideoCaption_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Sổ chi phí phụ đề chỉ được thêm (như AiUsage).
ALTER TABLE "SttUsage" ADD CONSTRAINT "SttUsage_cost_nonnegative" CHECK ("costVnd" >= 0);
CREATE TRIGGER "SttUsage_append_only" BEFORE UPDATE OR DELETE ON "SttUsage"
  FOR EACH ROW EXECUTE FUNCTION append_only();
