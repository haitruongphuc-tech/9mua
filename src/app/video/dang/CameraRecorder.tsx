'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/client';

// Quay trong app (SPEC-creator.md V5.5 mục 1): giữ nút để quay, thả để dừng; nhiều đoạn, xoá đoạn cuối; đổi camera,
// đèn (máy hỗ trợ), hẹn giờ 3/10 giây, tốc độ 0,5x–3x cho đoạn đang quay. Máy chủ ghép và đổi tốc độ khi xử lý.
export type RecordedSegment = { blob: Blob; speed: number; seconds: number };

const SPEEDS = [0.5, 1, 2, 3] as const;
const TIMERS = [0, 3, 10] as const;

function pickMime(): string | undefined {
  for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'])
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  return undefined;
}

export function CameraRecorder({
  maxSec,
  filter,
  onDone,
  onClose,
}: {
  maxSec: number;
  filter: string; // CSS filter xem trước của bộ lọc màu + làm đẹp
  onDone: (segments: RecordedSegment[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [torch, setTorch] = useState<boolean | null>(null); // null: máy không hỗ trợ đèn
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [countdown, setCountdown] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [segments, setSegments] = useState<RecordedSegment[]>([]);
  const [recording, setRecording] = useState(false);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const used = segments.reduce((sum, s) => sum + s.seconds / s.speed, 0);
  const live = recording ? (now - startedAt.current) / 1000 / speed : 0;

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop());
        stream.current = s;
        if (preview.current) preview.current.srcObject = s;
        const caps = s.getVideoTracks()[0]?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorch(caps?.torch ? false : null);
      })
      .catch(() => setError(t('post.camera.denied')));
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
    };
  }, [facing, t]);

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (used + (Date.now() - startedAt.current) / 1000 / speed >= maxSec) stop();
    }, 100);
    return () => clearInterval(id);
  }, [recording, used, speed, maxSec, stop]);

  const begin = () => {
    const s = stream.current;
    if (!s || recording || used >= maxSec) return;
    const chunks: Blob[] = [];
    const mimeType = pickMime();
    const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
    const segSpeed = speed;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setRecording(false);
      if (seconds >= 0.3)
        setSegments((list) => [
          ...list,
          { blob: new Blob(chunks, { type: rec.mimeType }), speed: segSpeed, seconds },
        ]);
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    setNow(Date.now());
    rec.start(250);
    setRecording(true);
  };

  const press = () => {
    if (timer === 0) return begin();
    // Hẹn giờ: đếm ngược rồi quay tới khi bấm lại (không cần giữ tay).
    if (recording) return stop();
    setCountdown(timer);
    let left: number = timer;
    const id = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(id);
        begin();
      }
    }, 1000);
  };

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    await track
      .applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      .catch(() => {});
    setTorch(!torch);
  };

  const btn =
    'flex h-10 min-w-10 items-center justify-center rounded-full bg-black/50 px-3 text-[12px] font-black';
  // Gắn thẳng vào <body>: phần tử cha của form có hiệu ứng làm "fixed" bám theo form thay vì cả màn hình.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white"
      data-testid="camera"
    >
      <video
        ref={preview}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter, transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
      />
      <div className="relative z-10 flex items-center justify-between p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className={btn} aria-label={t('post.camera.close')}>
          ✕
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            className={btn}
            aria-label={t('post.camera.flip')}
            data-testid="camera-flip"
            disabled={recording}
          >
            ⟲
          </button>
          {torch !== null ? (
            <button type="button" onClick={() => void toggleTorch()} className={btn} aria-pressed={torch}>
              ⚡
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTimer((x) => TIMERS[(TIMERS.indexOf(x) + 1) % TIMERS.length]!)}
            className={btn}
            data-testid="camera-timer"
            disabled={recording}
          >
            ⏱ {timer ? `${timer}s` : t('post.camera.timerOff')}
          </button>
        </div>
      </div>
      {/* Thanh thời lượng: đã quay / tối đa. */}
      <div className="relative z-10 mx-3 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full bg-brand"
          style={{ width: `${Math.min(100, ((used + live) / maxSec) * 100)}%` }}
        />
      </div>
      <p
        className="relative z-10 mt-1 text-center text-[12px] font-bold tabular-nums"
        data-testid="camera-time"
      >
        {(used + live).toFixed(1)}s / {maxSec}s · {t('post.camera.segments', { count: segments.length })}
      </p>
      {countdown > 0 ? (
        <span className="absolute inset-0 z-10 flex items-center justify-center text-[96px] font-black">
          {countdown}
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="relative z-10 m-4 rounded-[14px] bg-red-500/80 p-3 text-[13px] font-bold">
          {error}
        </p>
      ) : null}
      <div className="relative z-10 mt-auto flex flex-col items-center gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          className="flex gap-1 rounded-full bg-black/50 p-1"
          role="radiogroup"
          aria-label={t('post.camera.speed')}
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              disabled={recording}
              onClick={() => setSpeed(s)}
              data-testid={`camera-speed-${s}`}
              className={`h-8 rounded-full px-3 text-[12px] font-black ${speed === s ? 'bg-white text-black' : ''}`}
            >
              {String(s).replace('.', ',')}x
            </button>
          ))}
        </div>
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={() => setSegments((list) => list.slice(0, -1))}
            disabled={recording || segments.length === 0}
            className={`${btn} disabled:opacity-40`}
            data-testid="camera-delete"
          >
            ⌫ {t('post.camera.deleteLast')}
          </button>
          <button
            type="button"
            onPointerDown={timer === 0 ? press : undefined}
            onPointerUp={timer === 0 ? stop : undefined}
            onPointerLeave={timer === 0 ? stop : undefined}
            onClick={timer === 0 ? undefined : press}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!!error || used >= maxSec}
            aria-label={t('post.camera.hold')}
            data-testid="camera-record"
            className={`h-20 w-20 touch-none rounded-full border-4 border-white ${recording ? 'scale-110 bg-red-500' : 'bg-brand'} transition-transform disabled:opacity-40`}
          />
          <button
            type="button"
            onClick={() => onDone(segments)}
            disabled={recording || segments.length === 0}
            className={`${btn} bg-brand disabled:opacity-40`}
            data-testid="camera-done"
          >
            {t('post.camera.done')} ✓
          </button>
        </div>
        <p className="text-[11px] text-white/70">
          {t(timer ? 'post.camera.tapHint' : 'post.camera.holdHint')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
