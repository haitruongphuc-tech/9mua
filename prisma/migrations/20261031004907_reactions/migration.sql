-- AlterTable
ALTER TABLE "VideoLike" ADD COLUMN     "reaction" TEXT NOT NULL DEFAULT 'like';

-- CreateTable
CREATE TABLE "Repost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Repost_userId_createdAt_idx" ON "Repost"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Repost_userId_videoId_key" ON "Repost"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Repost_userId_postId_key" ON "Repost"("userId", "postId");

