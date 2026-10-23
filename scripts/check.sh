#!/bin/sh
# Cổng chất lượng trước mỗi commit: dừng ngay nếu lint/typecheck hoặc test lỗi.
set -e
npx prettier --check src tests e2e scripts >/dev/null
npm run lint --silent
npx vitest run --reporter=dot
