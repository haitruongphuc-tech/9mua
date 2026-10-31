-- CreateTable
CREATE TABLE "OriginDossier" (
    "id" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "commitAt" TIMESTAMP(3) NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "renewRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OriginDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OriginFile" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "OriginFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OriginDossier_kiotId_createdAt_idx" ON "OriginDossier"("kiotId", "createdAt");

-- CreateIndex
CREATE INDEX "OriginDossier_status_createdAt_idx" ON "OriginDossier"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OriginFile_dossierId_idx" ON "OriginFile"("dossierId");

-- AddForeignKey
ALTER TABLE "OriginDossier" ADD CONSTRAINT "OriginDossier_kiotId_fkey" FOREIGN KEY ("kiotId") REFERENCES "Kiot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginFile" ADD CONSTRAINT "OriginFile_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "OriginDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

