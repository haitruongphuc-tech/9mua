#!/bin/sh
# Chạy bản build standalone giống image Docker (dùng cho E2E sau `npm run build`).
set -e
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
exec node .next/standalone/server.js
