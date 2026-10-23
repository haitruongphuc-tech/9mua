#!/bin/sh
# Sao lưu 9mua.com mỗi đêm (cron 2:00, xem deploy/cron/9mua.cron). Khôi phục: docs/deploy.md mục "Sao lưu".
# - DB: pg_dump nén gzip, kiểm đọc lại được rồi mới giữ, giữ KEEP_DAYS ngày.
# - File: đồng bộ uploads/ và private/ (ảnh CCCD) sang thư mục sao lưu (quyền 700, chỉ root đọc).
# Nên chép thư mục sao lưu ra ngoài VPS (Google Drive/ổ khác) — mất VPS là mất cả bản sao lưu.
set -eu
BACKUP_DIR=${BACKUP_DIR:-/srv/9mua/backups}
DATA_DIR=${DATA_DIR:-/srv/9mua}
COMPOSE_DIR=${COMPOSE_DIR:-/opt/9mua}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)
umask 077
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/db-$STAMP.sql.gz"

if [ -n "${PG_DUMP_URL:-}" ]; then
  pg_dump --no-owner --no-privileges "$PG_DUMP_URL" | gzip -9 > "$OUT.tmp"
else
  (cd "$COMPOSE_DIR" && docker compose exec -T db pg_dump -U ninemua --no-owner --no-privileges ninemua) \
    | gzip -9 > "$OUT.tmp"
fi

# Bản sao lưu hỏng thì không thay bản cũ.
gzip -t "$OUT.tmp"
gzip -dc "$OUT.tmp" | tail -n 5 | grep -q 'PostgreSQL database dump complete'
mv "$OUT.tmp" "$OUT"
echo "DB: $OUT ($(du -h "$OUT" | cut -f1))"

if [ -z "${SKIP_FILES:-}" ] && [ -d "$DATA_DIR/uploads" ]; then
  mkdir -p "$BACKUP_DIR/files"
  for d in uploads private; do
    [ -d "$DATA_DIR/$d" ] && rsync -a "$DATA_DIR/$d/" "$BACKUP_DIR/files/$d/"
  done
  echo "File: $BACKUP_DIR/files"
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
