-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiStudio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draftWarnedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "placeName" TEXT,
ADD COLUMN     "profilePinnedAt" TIMESTAMP(3),
ADD COLUMN     "province" TEXT,
ADD COLUMN     "publishAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Video_status_publishAt_idx" ON "Video"("status", "publishAt");

