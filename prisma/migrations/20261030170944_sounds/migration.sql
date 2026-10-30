-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "originalVolume" INTEGER,
ADD COLUMN     "soundId" TEXT,
ADD COLUMN     "soundStartSec" DOUBLE PRECISION,
ADD COLUMN     "soundVolume" INTEGER;

-- CreateTable
CREATE TABLE "Sound" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "sourceVideoId" TEXT,
    "path" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sound_sourceVideoId_key" ON "Sound"("sourceVideoId");

-- CreateIndex
CREATE INDEX "Sound_status_kind_idx" ON "Sound"("status", "kind");

-- CreateIndex
CREATE INDEX "Video_soundId_status_readyAt_idx" ON "Video"("soundId", "status", "readyAt");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_soundId_fkey" FOREIGN KEY ("soundId") REFERENCES "Sound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

