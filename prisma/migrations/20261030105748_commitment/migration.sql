-- CreateTable
CREATE TABLE "CommitmentVersion" (
    "version" INTEGER NOT NULL,
    "lines" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" TEXT,

    CONSTRAINT "CommitmentVersion_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commitment_userId_idx" ON "Commitment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Commitment_userId_version_key" ON "Commitment"("userId", "version");


-- Sổ cam kết chỉ thêm, như các sổ tiền (hàm append_only có từ migration orders).
CREATE TRIGGER "Commitment_append_only" BEFORE UPDATE OR DELETE ON "Commitment"
  FOR EACH ROW EXECUTE FUNCTION append_only();

-- Bản cam kết đầu tiên: 4 dòng mặc định (lines = null).
INSERT INTO "CommitmentVersion" ("version", "lines", "publishedAt") VALUES (1, NULL, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
