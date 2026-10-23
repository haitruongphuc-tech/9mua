#!/bin/sh
# Tạo các video mẫu nhỏ cho test của module creator (đã commit sẵn trong tests/fixtures/videos/).
# Chạy lại khi cần: sh scripts/make-video-fixtures.sh
set -e
OUT=tests/fixtures/videos
mkdir -p "$OUT"
FF="ffmpeg -hide_banner -loglevel error -y"

# Giống iPhone: HEVC trong MOV, lưu ngang 640x360 kèm cờ xoay 90° (hiển thị dọc), có toạ độ GPS.
TMP=$(mktemp -d)
$FF -f lavfi -i testsrc2=size=640x360:rate=30 -f lavfi -i sine=frequency=440:sample_rate=44100 \
  -t 2 -c:v libx265 -preset ultrafast -x265-params log-level=error -tag:v hvc1 -pix_fmt yuv420p -c:a aac -b:a 64k \
  "$TMP/raw.mov"
$FF -display_rotation 90 -i "$TMP/raw.mov" -c copy -tag:v hvc1 \
  -metadata location="+10.7769+106.7009/" -metadata make=Apple -metadata model="iPhone 15" \
  "$OUT/iphone-hevc.mov"
rm -r "$TMP"

# MP4 ngang 1280x720 H.264.
$FF -f lavfi -i testsrc=size=1280x720:rate=25 -f lavfi -i sine=frequency=660 -t 2 \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 64k "$OUT/landscape.mp4"

# Video 75 giây (vượt giới hạn 60 giây), rất nhỏ.
$FF -f lavfi -i color=c=orange:size=64x64:rate=1 -t 75 -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
  "$OUT/long-75s.mp4"

# Không phải video, chỉ đổi đuôi .mp4.
printf 'day khong phai video, chi doi duoi file\n' > "$OUT/fake.mp4"
ls -l "$OUT"
