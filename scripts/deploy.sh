#!/bin/sh
# Cập nhật 9mua.com lên bản mới nhất trên GitHub. Chạy tay trên VPS (docs/deploy.md mục 9):
#   cd /opt/9mua && sh scripts/deploy.sh             cập nhật
#   cd /opt/9mua && sh scripts/deploy.sh --rollback  quay về bản trước lần cập nhật gần nhất
# Thứ tự: kéo code → build image mới (web cũ vẫn chạy) → sao lưu DB → migration → chạy bản mới → kiểm tra.
# Lỗi ở bất kỳ bước nào thì tự quay về code và image cũ. Migration đã chạy thì giữ nguyên (chỉ thêm, bản cũ
# vẫn chạy được); cần thì khôi phục DB từ bản sao lưu in ra cuối cùng.
set -eu
cd "$(dirname "$0")/.."

BRANCH=${DEPLOY_BRANCH:-main}
GITDIR=$(git rev-parse --git-dir)
SUDO=
[ "$(id -u)" -eq 0 ] || SUDO=sudo
env_value() { sed -n "s/^$1=//p" .env | tail -n 1 | tr -d "\"'"; }

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\n[LỖI] %s\n' "$*" >&2; exit 1; }

# Một lúc chỉ một lần deploy.
exec 9>"$GITDIR/deploy.lock"
flock -n 9 || die 'Đang có một lần deploy khác chạy.'

[ -f .env ] || die 'Thiếu file .env (docs/deploy.md mục 4).'
git diff --quiet && git diff --cached --quiet ||
  die 'Có file trong thư mục code bị sửa tay (xem: git status). Dừng để không ghi đè thay đổi đó.'
[ "$(git symbolic-ref --short -q HEAD)" = "$BRANCH" ] || die "Thư mục code không ở nhánh $BRANCH."

BASE="http://127.0.0.1:$(env_value APP_PORT | grep . || echo 3009)"
HOST=$(env_value APP_URL | sed 's#^[a-z]*://##; s#/.*##' | grep . || echo 9mua.com)

# Web trả lời /api/health và trang chủ (trang chủ đọc DB) trong 90 giây; worker không bị khởi động lại liên tục.
healthy() {
  i=0
  while [ "$i" -lt 45 ]; do
    if curl -fsS -m 5 -o /dev/null "$BASE/api/health" 2>/dev/null &&
      curl -fsS -m 15 -o /dev/null -H "Host: $HOST" "$BASE/" 2>/dev/null; then
      sleep 5
      [ "$(docker compose ps worker --format '{{.State}}')" = running ] && return 0
      echo 'Worker (xử lý video) không chạy.' >&2
      return 1
    fi
    i=$((i + 1))
    sleep 2
  done
  return 1
}

retag() { # retag <từ> <sang>: ninemua-app/worker:<từ> → :<sang>
  for s in app worker; do
    if docker image inspect "ninemua-$s:$1" >/dev/null 2>&1; then docker tag "ninemua-$s:$1" "ninemua-$s:$2"; fi
  done
}

if [ "${1:-}" = '--rollback' ]; then
  [ -f "$GITDIR/deploy-previous" ] && docker image inspect ninemua-app:rollback >/dev/null 2>&1 ||
    die 'Không có bản trước để quay về (chỉ quay về được 1 lần sau mỗi lần cập nhật).'
  PREV=$(cat "$GITDIR/deploy-previous")
  say "Quay về $(git --no-pager log -1 --format='%h %s' "$PREV")"
  retag rollback latest
  git reset --quiet --hard "$PREV"
  docker compose up -d --no-build app worker
  rm -f "$GITDIR/deploy-previous"
  healthy || die 'Đã quay về nhưng web chưa lên. Xem: docker compose logs --tail 100 app'
  say 'Xong. Lần chạy deploy kế tiếp sẽ lấy lại bản mới nhất trên GitHub, nên chỉ chạy khi đã có bản sửa lỗi.'
  exit 0
fi

say 'Kiểm tra bản mới trên GitHub'
git fetch --quiet origin "$BRANCH"
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
if [ "$OLD" = "$NEW" ]; then
  echo "Đang chạy bản mới nhất: $(git --no-pager log -1 --format='%h %s')"
  exit 0
fi
git merge-base --is-ancestor "$OLD" "$NEW" ||
  die "Lịch sử trên GitHub không nối tiếp bản đang chạy ($OLD). Dừng lại, cần kiểm tra tay."
git --no-pager log --reverse --format='  %h %s' "$OLD..$NEW"

SWITCHED=0
BACKUP=
fail() {
  printf '\n[LỖI] %s\n' "$1" >&2
  git reset --quiet --hard "$OLD"
  retag rollback latest
  if [ "$SWITCHED" = 1 ]; then
    docker compose up -d --no-build app worker
    if healthy; then echo "Đã quay về bản cũ ($(git --no-pager log -1 --format=%h)), web chạy bình thường."
    else echo 'Đã quay về bản cũ nhưng web vẫn chưa lên. Xem: docker compose logs --tail 100 app'; fi
  else
    echo 'Web vẫn chạy bản cũ, chưa bị đụng tới.'
  fi
  if [ -n "$BACKUP" ]; then echo "Bản sao lưu DB ngay trước lần deploy này: $BACKUP"; fi
  exit 1
}

# Image đang chạy được giữ lại (tag :rollback) để quay về khi bản mới lỗi. Ô quay về giờ chứa bản đang chạy,
# nên bỏ ghi chú commit của lần cập nhật trước (--rollback chỉ dùng được sau một lần cập nhật thành công).
rm -f "$GITDIR/deploy-previous"
retag latest rollback
git merge --quiet --ff-only "$NEW"

say 'Build bản mới (web cũ vẫn chạy, mất vài phút)'
docker compose --profile tools build app worker migrate || fail 'Build lỗi.'

for k in $(git diff "$OLD" "$NEW" -- .env.example | sed -n 's/^+\([A-Z_][A-Z0-9_]*\)=.*/\1/p'); do
  grep -q "^$k=" .env || echo "[CHÚ Ý] Bản mới thêm biến $k trong .env.example, .env chưa có."
done

say 'Sao lưu database'
out=$($SUDO env SKIP_FILES=1 COMPOSE_DIR="$PWD" sh scripts/backup-db.sh) || fail 'Sao lưu lỗi, dừng deploy.'
BACKUP=$(printf '%s\n' "$out" | sed -n 's/^DB: \([^ ]*\).*/\1/p')

say 'Nâng cấp database (migration)'
docker compose run --rm migrate || fail 'Migration lỗi.'

say 'Chạy bản mới'
SWITCHED=1
docker compose up -d --no-build app worker || fail 'Không khởi động được bản mới.'
healthy || fail 'Bản mới không chạy được (kiểm tra 90 giây).'

# Máy chủ hình cho Live (SPEC-live.md). Lỗi ở đây không quay về bản cũ vì web vẫn chạy, chỉ báo để xem.
# Đổi cấu hình MediaMTX thì tạo lại container để nó đọc file mới.
if git diff --quiet "$OLD" "$NEW" -- deploy/mediamtx docker-compose.yml; then recreate=; else recreate=--force-recreate; fi
docker compose up -d $recreate mediamtx >/dev/null 2>&1 ||
  echo '[CHÚ Ý] MediaMTX (Live) chưa chạy. Xem (đã che khoá): docker compose logs --tail 50 mediamtx | sed "s/key=[^\" ]*/key=***/g"'

echo "$OLD" >"$GITDIR/deploy-previous"
docker image prune -f >/dev/null
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
say "Xong: đang chạy $(git --no-pager log -1 --format='%h %s')"
echo "Bản sao lưu DB ngay trước lần deploy này: $BACKUP"
changed=$(git diff --name-only "$OLD" "$NEW" -- deploy/cron deploy/nginx)
if [ -n "$changed" ]; then
  echo '[CHÚ Ý] Bản này đổi file cấu hình, cần chép lại theo docs/deploy.md (mục 6 và 8):'
  printf '  %s\n' $changed
fi
