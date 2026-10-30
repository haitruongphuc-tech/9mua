-- AlterTable
ALTER TABLE "User" ADD COLUMN     "handle" TEXT,
ADD COLUMN     "handleChangedAt" TIMESTAMP(3),
ADD COLUMN     "previousHandle" TEXT,
ADD COLUMN     "previousHandleUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_previousHandle_key" ON "User"("previousHandle");

