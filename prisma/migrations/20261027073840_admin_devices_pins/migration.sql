-- CreateEnum
CREATE TYPE "PinKind" AS ENUM ('video', 'kiot');

-- CreateTable
CREATE TABLE "AdminTrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "pwFingerprint" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AdminTrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL,
    "kind" "PinKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "until" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTrustedDevice_tokenHash_key" ON "AdminTrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminTrustedDevice_userId_idx" ON "AdminTrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "Pin_kind_position_idx" ON "Pin"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Pin_kind_targetId_key" ON "Pin"("kind", "targetId");

