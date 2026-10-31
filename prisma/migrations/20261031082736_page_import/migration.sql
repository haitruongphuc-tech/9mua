-- CreateTable
CREATE TABLE "PageImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarPath" TEXT,
    "url" TEXT NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "tokenEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageImport_updatedAt_idx" ON "PageImport"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PageImport_userId_network_externalId_key" ON "PageImport"("userId", "network", "externalId");

