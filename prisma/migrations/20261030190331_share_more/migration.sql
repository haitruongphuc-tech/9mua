-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "videoId" TEXT;

-- CreateTable
CREATE TABLE "VideoDownload" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "path" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "VideoDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoDownloadLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoDownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoDownload_videoId_key" ON "VideoDownload"("videoId");

-- CreateIndex
CREATE INDEX "VideoDownload_status_createdAt_idx" ON "VideoDownload"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VideoDownloadLog_userId_createdAt_idx" ON "VideoDownloadLog"("userId", "createdAt");

