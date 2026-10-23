-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'expired', 'cancelled', 'mismatch');

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "orderCode" BIGINT NOT NULL,
    "purpose" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentLinkId" TEXT,
    "checkoutUrl" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "amountPaid" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderCode" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "transactionDateTime" TEXT NOT NULL,
    "counterAccountName" TEXT,
    "counterAccountNumber" TEXT,
    "counterAccountBankName" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FakePayosLink" (
    "orderCode" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "transactions" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "FakePayosLink_pkey" PRIMARY KEY ("orderCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_orderCode_key" ON "PaymentIntent"("orderCode");

-- CreateIndex
CREATE INDEX "PaymentIntent_purpose_refId_status_idx" ON "PaymentIntent"("purpose", "refId", "status");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_createdAt_idx" ON "PaymentIntent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_outcome_idx" ON "PaymentEvent"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_orderCode_reference_key" ON "PaymentEvent"("orderCode", "reference");

-- orderCode PayOS: số nguyên dương duy nhất, không dùng Date.now() (dễ trùng).
CREATE SEQUENCE payment_order_code_seq START WITH 100001;

-- Sổ cái tiền vào không bao giờ bị sửa hay xoá.
CREATE FUNCTION payment_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PaymentEvent là sổ cái chỉ thêm, không được sửa/xoá';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER payment_event_no_update_delete
  BEFORE UPDATE OR DELETE ON "PaymentEvent"
  FOR EACH ROW EXECUTE FUNCTION payment_event_append_only();
