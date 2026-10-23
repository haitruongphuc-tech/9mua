import { describe, expect, it } from 'vitest';
import { extractHashtags } from './hashtags';
import { feedScore } from './score';
import { rejectReason, type Probe } from './transcode';

describe('hashtag', () => {
  it('tách, bỏ dấu, chữ thường, không trùng', () => {
    expect(extractHashtags('Ngon lắm #ThanhLòng #thanhlong #Đặc_Sản và #2026')).toEqual([
      'thanhlong',
      'dac_san',
      '2026',
    ]);
    expect(extractHashtags('không có thẻ # nào')).toEqual([]);
  });
});

describe('điểm feed', () => {
  it('video mới chưa tương tác vẫn > 0; video cũ nhiều thích giảm dần theo thời gian', () => {
    expect(feedScore({ likes: 0, qualifiedViews: 0, ageHours: 0 })).toBeGreaterThan(0);
    const fresh = feedScore({ likes: 10, qualifiedViews: 50, ageHours: 1 });
    const day = feedScore({ likes: 10, qualifiedViews: 50, ageHours: 24 });
    const week = feedScore({ likes: 10, qualifiedViews: 50, ageHours: 168 });
    expect(fresh).toBeGreaterThan(day);
    expect(day).toBeGreaterThan(week);
    expect(feedScore({ likes: 100, qualifiedViews: 0, ageHours: 5 })).toBeGreaterThan(
      feedScore({ likes: 1, qualifiedViews: 0, ageHours: 5 }),
    );
  });
});

describe('kiểm video bằng ffprobe', () => {
  const ok: Probe = {
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    durationSec: 12,
    video: { codec: 'hevc', width: 1080, height: 1920 },
    hasAudio: true,
    tags: {},
  };
  it('nhận MP4/MOV/WebM ≤ 60 giây', () => {
    expect(rejectReason(ok)).toBeNull();
    expect(rejectReason({ ...ok, formatName: 'matroska,webm' })).toBeNull();
    expect(rejectReason({ ...ok, durationSec: 60.4 })).toBeNull();
  });
  it('từ chối quá 60 giây, không có hình, định dạng lạ', () => {
    expect(rejectReason({ ...ok, durationSec: 75 })).toBe('Video dài hơn 60 giây');
    expect(rejectReason({ ...ok, video: null })).toBe('File không phải video MP4, MOV hoặc WebM');
    expect(rejectReason({ ...ok, formatName: 'gif' })).toBe('File không phải video MP4, MOV hoặc WebM');
    expect(rejectReason({ ...ok, video: { codec: 'h264', width: 8000, height: 8000 } })).toBe(
      'Độ phân giải video quá lớn',
    );
  });
});
