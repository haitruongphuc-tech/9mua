-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showLikedVideos" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SuggestionDismiss" (
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionDismiss_pkey" PRIMARY KEY ("userId","targetId")
);

