-- CreateTable
CREATE TABLE "Kiot" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "province" TEXT,
    "district" TEXT,
    "addressLine" TEXT,
    "activeUntil" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kiot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kiot_ownerId_key" ON "Kiot"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Kiot_slug_key" ON "Kiot"("slug");

-- AddForeignKey
ALTER TABLE "Kiot" ADD CONSTRAINT "Kiot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
