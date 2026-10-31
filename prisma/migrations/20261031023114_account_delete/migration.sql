-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deleteRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3);

