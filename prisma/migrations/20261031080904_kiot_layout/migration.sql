-- AlterTable
ALTER TABLE "Kiot" ADD COLUMN     "layout" JSONB,
ADD COLUMN     "warrantyDefault" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "warranty" TEXT;

