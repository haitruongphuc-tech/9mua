-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FollowRequest" (
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("requesterId","targetId")
);

-- CreateIndex
CREATE INDEX "FollowRequest_targetId_createdAt_idx" ON "FollowRequest"("targetId", "createdAt");

