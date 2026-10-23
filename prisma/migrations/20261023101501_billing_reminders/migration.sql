-- CreateTable
CREATE TABLE "BillingReminder" (
    "kiotId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingReminder_pkey" PRIMARY KEY ("kiotId","milestone","periodEnd")
);
