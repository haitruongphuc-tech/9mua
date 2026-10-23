-- Ghi rõ schema trong thân hàm: pg_dump khôi phục với search_path rỗng, nên tên hàm không ghi "public."
-- làm hỏng việc dựng lại chỉ mục tìm kiếm khi khôi phục bản sao lưu (phát hiện khi thử khôi phục ở T36).
CREATE OR REPLACE FUNCTION public.search_norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT pg_catalog.regexp_replace(pg_catalog.lower(public.immutable_unaccent($1)), '\s+', ' ', 'g') $$;

CREATE OR REPLACE FUNCTION public.product_search_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchName" := public.search_norm(NEW.name);
  RETURN NEW;
END $$;
