#!/bin/sh
# Lệnh của container: web (mặc định) | worker | <lệnh bất kỳ>. Migration chạy bằng service `migrate`.
set -e
case "$1" in
  web) exec node server.js ;;
  worker) exec node dist/scripts/worker.mjs ;;
  *) exec "$@" ;;
esac
