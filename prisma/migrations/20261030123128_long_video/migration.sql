-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "sourceSec" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN     "lane" TEXT NOT NULL DEFAULT 'short';

-- CreateTable
CREATE TABLE "VideoUploadSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "partSize" INTEGER NOT NULL,
    "parts" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "uploadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoUploadSession_userId_status_idx" ON "VideoUploadSession"("userId", "status");

-- CreateIndex
CREATE INDEX "VideoUploadSession_status_expiresAt_idx" ON "VideoUploadSession"("status", "expiresAt");

