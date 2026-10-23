-- AlterTable
ALTER TABLE "Kiot" ADD COLUMN     "freeShippingThreshold" INTEGER,
ADD COLUMN     "shippingFee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CartItem" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "sourceVideoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("userId","productId")
);

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Kiot" ADD CONSTRAINT "Kiot_shipping_fee_range" CHECK ("shippingFee" BETWEEN 0 AND 200000);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_qty_positive" CHECK ("qty" > 0);
