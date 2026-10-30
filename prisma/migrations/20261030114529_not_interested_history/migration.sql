-- AlterTable
ALTER TABLE "User" ADD COLUMN     "historyOff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VideoNotInterested" (
    "viewerKey" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoNotInterested_pkey" PRIMARY KEY ("viewerKey","videoId")
);

-- CreateTable
CREATE TABLE "ViewHistory" (
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewHistory_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateIndex
CREATE INDEX "VideoNotInterested_viewerKey_authorId_createdAt_idx" ON "VideoNotInterested"("viewerKey", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ViewHistory_userId_lastViewedAt_idx" ON "ViewHistory"("userId", "lastViewedAt");

