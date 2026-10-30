-- CreateTable
CREATE TABLE "RateWindow" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateWindow_pkey" PRIMARY KEY ("key")
);

