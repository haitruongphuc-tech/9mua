import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { getIntSetting } from '@/lib/settings';

// Giới hạn video (SPEC-creator.md V5.1, công tắc long_video). Tắt: như cũ ≤ 60 giây, ≤ 100MB. Bật: ≤ video_long_max_seconds
// và ≤ video_max_mb (CEO chỉnh ở /admin/cai-dat); video > 60 giây cần tài khoản ≥ 3 ngày, tổng ≤ 120 phút mỗi ngày.
export const SHORT_MAX_BYTES = 100 * 1024 * 1024;
export const SHORT_MAX_SEC = 60;
export const LONG_MIN_ACCOUNT_DAYS = 3;

export type VideoLimits = {
  long: boolean;
  maxBytes: number;
  maxSec: number; // video thường (Story luôn ≤ 30 giây)
  longDailySec: number;
};

export async function videoLimits(): Promise<VideoLimits> {
  if (!(await isFeatureOn('long_video')))
    return { long: false, maxBytes: SHORT_MAX_BYTES, maxSec: SHORT_MAX_SEC, longDailySec: 0 };
  const [maxSec, maxMb, dailyMinutes] = await Promise.all([
    getIntSetting('video_long_max_seconds'),
    getIntSetting('video_max_mb'),
    getIntSetting('video_long_daily_minutes'),
  ]);
  return { long: true, maxBytes: maxMb * 1024 * 1024, maxSec, longDailySec: dailyMinutes * 60 };
}

export type LongVideoError = 'TOO_LONG' | 'ACCOUNT_TOO_NEW' | 'LONG_DAILY_LIMIT';

// Video dài hơn 60 giây có được đăng không (đo ở trình duyệt khi mở phiên, đo lại bằng ffprobe khi tạo video).
export async function checkLongVideo(
  userId: string,
  durationSec: number,
  limits: VideoLimits,
): Promise<LongVideoError | null> {
  if (!(durationSec > SHORT_MAX_SEC + 0.5)) return null;
  if (!limits.long || durationSec > limits.maxSec + 0.5) return 'TOO_LONG';
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, lockedAt: true },
  });
  if (!user || user.lockedAt) return 'ACCOUNT_TOO_NEW';
  if (now().getTime() - user.createdAt.getTime() < LONG_MIN_ACCOUNT_DAYS * 86_400_000)
    return 'ACCOUNT_TOO_NEW';
  const today = await db.video.aggregate({
    where: {
      authorId: userId,
      createdAt: { gte: startOfVnDay() },
      sourceSec: { gt: SHORT_MAX_SEC + 0.5 },
      status: { not: 'failed' },
    },
    _sum: { sourceSec: true },
  });
  if ((today._sum.sourceSec ?? 0) + durationSec > limits.longDailySec) return 'LONG_DAILY_LIMIT';
  return null;
}
