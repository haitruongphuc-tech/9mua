-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "replyVideoId" TEXT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "replyCardX" DOUBLE PRECISION,
ADD COLUMN     "replyCardY" DOUBLE PRECISION,
ADD COLUMN     "replyToCommentId" TEXT;

