-- AlterTable
ALTER TABLE "XuEntry" ADD COLUMN     "refId" TEXT;

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "vnDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointEntry_userId_vnDay_idx" ON "PointEntry"("userId", "vnDay");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_userId_kind_refId_key" ON "PointEntry"("userId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "XuEntry_kind_refId_key" ON "XuEntry"("kind", "refId");


-- Sổ điểm thưởng chỉ được thêm (SPEC-social.md V5.6): sửa sai bằng dòng bù (revoke), không sửa / xoá dòng.
CREATE TRIGGER "PointEntry_append_only" BEFORE UPDATE OR DELETE ON "PointEntry"
  FOR EACH ROW EXECUTE FUNCTION append_only();
