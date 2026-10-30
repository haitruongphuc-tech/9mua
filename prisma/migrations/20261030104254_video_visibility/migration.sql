-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowDownload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowRemix" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'public';

