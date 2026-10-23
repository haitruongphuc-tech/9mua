-- CreateTable
CREATE TABLE "PaymentIssueResolution" (
    "issueKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "resolvedById" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentIssueResolution_pkey" PRIMARY KEY ("issueKey")
);
