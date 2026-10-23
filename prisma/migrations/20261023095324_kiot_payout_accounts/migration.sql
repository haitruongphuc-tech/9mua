-- CreateTable
CREATE TABLE "KiotPayoutAccount" (
    "id" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "bankBin" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KiotPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KiotPayoutAccount_kiotId_createdAt_idx" ON "KiotPayoutAccount"("kiotId", "createdAt");

-- AddForeignKey
ALTER TABLE "KiotPayoutAccount" ADD CONSTRAINT "KiotPayoutAccount_kiotId_fkey" FOREIGN KEY ("kiotId") REFERENCES "Kiot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
