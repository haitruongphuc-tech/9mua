-- CreateTable
CREATE TABLE "ProductSale" (
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kiotId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSale_pkey" PRIMARY KEY ("orderId","productId")
);

-- CreateTable
CREATE TABLE "ProductSalesStat" (
    "productId" TEXT NOT NULL,
    "sold30d" INTEGER NOT NULL DEFAULT 0,
    "soldTotal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSalesStat_pkey" PRIMARY KEY ("productId")
);

-- CreateIndex
CREATE INDEX "ProductSale_completedAt_idx" ON "ProductSale"("completedAt");

-- CreateIndex
CREATE INDEX "ProductSale_kiotId_completedAt_idx" ON "ProductSale"("kiotId", "completedAt");

-- CreateIndex
CREATE INDEX "ProductSalesStat_sold30d_idx" ON "ProductSalesStat"("sold30d");

-- Tìm kiếm tiếng Việt: gõ có dấu hay không dấu, sai nhẹ vẫn ra (SPEC-marketplace.md mục 3).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() chỉ là STABLE nên không dùng trong chỉ mục được; bọc lại thành IMMUTABLE với từ điển cố định.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Chuẩn hoá để so khớp: bỏ dấu (kể cả đ → d), chữ thường, gộp khoảng trắng.
CREATE OR REPLACE FUNCTION search_norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT regexp_replace(lower(immutable_unaccent($1)), '\s+', ' ', 'g') $$;

CREATE INDEX "Product_name_search_trgm" ON "Product" USING gin (search_norm(name) gin_trgm_ops);
CREATE INDEX "Product_description_search_trgm" ON "Product" USING gin (search_norm(description) gin_trgm_ops);
CREATE INDEX "Product_market_listing" ON "Product" ("kiotId", category, "createdAt")
  WHERE visible = true AND "deletedAt" IS NULL AND "hiddenByAdminAt" IS NULL;

CREATE TRIGGER "ProductSale_append_only" BEFORE UPDATE OR DELETE ON "ProductSale"
  FOR EACH ROW EXECUTE FUNCTION append_only();
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_qty_positive" CHECK (qty > 0);
