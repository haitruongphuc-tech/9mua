-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "hiddenReason" TEXT,
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mentionPolicy" TEXT NOT NULL DEFAULT 'everyone';

-- CreateTable
CREATE TABLE "CommentLike" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("commentId","userId")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutedKeyword" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "folded" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentLike_userId_createdAt_idx" ON "CommentLike"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Mention_userId_createdAt_idx" ON "Mention"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mention_sourceType_sourceId_userId_key" ON "Mention"("sourceType", "sourceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MutedKeyword_userId_folded_key" ON "MutedKeyword"("userId", "folded");

