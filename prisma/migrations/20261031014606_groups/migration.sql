-- CreateTable
CREATE TABLE "CommunityGroup" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "avatarPath" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "approvePosts" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lockReason" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT,
    "videoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupReport" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "communityPostId" TEXT,
    "target" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityGroup_ownerId_idx" ON "CommunityGroup"("ownerId");

-- CreateIndex
CREATE INDEX "CommunityGroup_status_privacy_memberCount_idx" ON "CommunityGroup"("status", "privacy", "memberCount");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_status_idx" ON "CommunityMember"("userId", "status");

-- CreateIndex
CREATE INDEX "CommunityMember_groupId_status_idx" ON "CommunityMember"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPost_postId_key" ON "CommunityPost"("postId");

-- CreateIndex
CREATE INDEX "CommunityPost_groupId_status_createdAt_idx" ON "CommunityPost"("groupId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_videoId_idx" ON "CommunityPost"("videoId");

-- CreateIndex
CREATE INDEX "GroupReport_status_createdAt_idx" ON "GroupReport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupReport_userId_target_key" ON "GroupReport"("userId", "target");

