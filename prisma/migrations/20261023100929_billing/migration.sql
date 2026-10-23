-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "KiotSubscription" (
    "id" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "intentId" TEXT,
    "amount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "grantedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KiotSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KiotSubscription_intentId_key" ON "KiotSubscription"("intentId");

-- CreateIndex
CREATE INDEX "KiotSubscription_kiotId_createdAt_idx" ON "KiotSubscription"("kiotId", "createdAt");

-- AddForeignKey
ALTER TABLE "KiotSubscription" ADD CONSTRAINT "KiotSubscription_kiotId_fkey" FOREIGN KEY ("kiotId") REFERENCES "Kiot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
