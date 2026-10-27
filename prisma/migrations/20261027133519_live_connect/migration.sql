-- CreateTable
CREATE TABLE "LiveConnect" (
    "liveId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveConnect_pkey" PRIMARY KEY ("liveId","viewerKey")
);

-- CreateIndex
CREATE INDEX "LiveConnect_createdAt_idx" ON "LiveConnect"("createdAt");
