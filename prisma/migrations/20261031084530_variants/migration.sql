-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantId" TEXT,
ADD COLUMN     "variantLabel" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "optionNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "option1" TEXT NOT NULL,
    "option2" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_position_idx" ON "ProductVariant"("productId", "position");


-- Tồn kho biến thể không âm (chốt chặn cuối như Product_stock_nonnegative).
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonnegative" CHECK (stock >= 0);
