#!/bin/sh
# Lệnh của container: web (mặc định) | worker | <lệnh bất kỳ>. Migration chạy bằng service `migrate`.
set -e
case "$1" in
  web) exec node server.js ;;
  worker)
    # Worker chuyển mã video được viết ở task T28.
    echo "worker: chưa có việc (T28)"
    exec node -e "setInterval(() => {}, 1 << 30)"
    ;;
  *) exec "$@" ;;
esac
