-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "atSecond" INTEGER;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "episodeNo" INTEGER,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "watchOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverPath" TEXT,
    "genre" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesFollow" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesFollow_pkey" PRIMARY KEY ("userId","seriesId")
);

-- CreateTable
CREATE TABLE "SeriesProgress" (
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "second" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesProgress_pkey" PRIMARY KEY ("userId","seriesId")
);

-- CreateTable
CREATE TABLE "EpisodeWatched" (
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatched_pkey" PRIMARY KEY ("userId","videoId")
);

-- CreateIndex
CREATE INDEX "Series_ownerId_updatedAt_idx" ON "Series"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Series_updatedAt_idx" ON "Series"("updatedAt");

-- CreateIndex
CREATE INDEX "SeriesFollow_seriesId_idx" ON "SeriesFollow"("seriesId");

-- CreateIndex
CREATE INDEX "Video_seriesId_episodeNo_idx" ON "Video"("seriesId", "episodeNo");

