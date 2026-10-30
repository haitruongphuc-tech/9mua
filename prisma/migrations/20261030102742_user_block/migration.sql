-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");


-- Chép các chặn cũ ở Hộp thư sang chặn toàn web (chỉ thêm dòng, MessageBlock giữ nguyên).
INSERT INTO "UserBlock" ("blockerId", "blockedId", "createdAt")
SELECT "blockerId", "blockedId", "createdAt" FROM "MessageBlock"
ON CONFLICT DO NOTHING;
