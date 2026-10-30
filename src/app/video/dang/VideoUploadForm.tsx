'use client';

import { Repeat2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useFeature } from '@/components/MeProvider';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { PickableProduct } from '@/app/api/video/products/route';
import { createVideoAction } from './actions';
import { CameraRecorder } from './CameraRecorder';
import { chunkedUpload, type UploadProgress } from './chunked-upload';
import { CSS_LOOKS, cssBeauty, LOOKS, MAX_BEAUTY, type Look } from '@/lib/looks';
import { MAX_CLIPS, type EditSpec } from '@/lib/edit-spec';
import { EditOverlay, EditPanel, emptyEdit } from './VideoEditor';
import { SoundPicker, type PickedSound } from './SoundPicker';
import type { SoundItem } from '@/app/api/sounds/route';

const MAX_CAPTION = 300;
const STORY_SEC = 30;
type Mode = 'video' | 'story';

// Một đoạn để ghép (SPEC-creator.md V5.6 mục 1): đoạn quay trong app hoặc file chọn thêm. seconds là thời lượng sau khi
// đổi tốc độ (null: trình duyệt chưa đọc được).
type Clip = {
  key: number;
  name: string;
  blob: Blob;
  speed: number;
  seconds: number | null;
  recorded: boolean;
};
const MAX_JOIN_PARTS = 20; // bằng MAX_SEGMENTS của máy chủ
const MAX_JOIN_BYTES = 200 * 1024 * 1024; // bằng giới hạn của /api/video/recording

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
const clockText = (sec: number) =>
  sec >= 3600
    ? `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
    : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Gửi các đoạn quay trong app (SPEC-creator.md V5.5) để máy chủ ghép, có thanh tiến trình.
function postRecording(
  segments: { blob: Blob; speed: number }[],
  onProgress: (pct: number) => void,
  messages: { failed: string; offline: string },
): Promise<{ ok: boolean; uploadId?: string; message?: string }> {
  const form = new FormData();
  form.set('speeds', JSON.stringify(segments.map((s) => s.speed)));
  segments.forEach((s, i) =>
    form.set(`s${i}`, s.blob, `s${i}.${s.blob.type.includes('mp4') ? 'mp4' : 'webm'}`),
  );
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/video/recording');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, message: messages.failed });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: messages.offline });
    xhr.send(form);
  });
}

function putWithProgress(
  file: File,
  onProgress: (pct: number) => void,
  messages: { failed: string; offline: string },
): Promise<{ ok: boolean; uploadId?: string; message?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/video/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, message: messages.failed });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: messages.offline });
    xhr.send(file);
  });
}

export function VideoUploadForm({
  remaining,
  initialMode,
  duet,
  stitch,
  provinces,
  defaultProvince,
  limits,
  initialSound,
  series,
}: {
  remaining: Record<Mode, number>;
  initialMode: Mode;
  duet: { id: string; author: string; posterUrl: string | null } | null;
  stitch: { id: string; author: string; fileUrl: string; durationSec: number } | null;
  provinces: { slug: string; name: string }[];
  defaultProvince: string;
  // Giới hạn theo công tắc long_video (SPEC-creator.md V5.1). Bật thì tải từng phần 8MB, gửi tiếp được khi rớt mạng.
  limits: { long: boolean; maxBytes: number; maxSec: number };
  initialSound: SoundItem | null; // "Dùng âm thanh này" (SPEC-creator.md V5.6 mục 2)
  series: { id: string; title: string; next: number }[]; // Phim của tôi (V5.9): gắn tập ngay khi đăng
}) {
  const maxSec = (m: Mode) => (m === 'story' ? STORY_SEC : limits.maxSec);
  const t = useT();
  // Duet luôn là video thường.
  const [mode, setMode] = useState<Mode>(duet || stitch ? 'video' : initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableProduct[]>([]);
  const [picked, setPicked] = useState<PickableProduct[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [detail, setDetail] = useState<UploadProgress | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  // Quyền riêng tư và tuỳ chọn khi đăng (SPEC-creator.md V5.3, công tắc post_options).
  const postOptions = useFeature('post_options');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [allow, setAllow] = useState({ allowComments: true, allowRemix: true, allowDownload: true });
  // Địa điểm (mặc định tỉnh của Kiot), nhãn AI, hẹn giờ (giờ Việt Nam) — SPEC-creator.md V5.3.
  const [province, setProvince] = useState(defaultProvince);
  const [placeName, setPlaceName] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  // Phụ đề tự động (SPEC-creator.md V5.4, công tắc auto_captions).
  const captionsOn = useFeature('auto_captions');
  const [autoCaptions, setAutoCaptions] = useState(false);
  // Quay trong app, bộ lọc màu, làm đẹp (SPEC-creator.md V5.5, công tắc camera). Trình duyệt không cho camera thì chỉ
  // còn nút chọn file.
  const cameraOn = useFeature('camera');
  const [canRecord, setCanRecord] = useState(false);
  useEffect(
    () => setCanRecord(Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'),
    [],
  );
  const [recorderOpen, setRecorderOpen] = useState(false);
  // Đoạn quay và đoạn ghép thêm (V5.6): có đoạn thì gửi qua /api/video/recording để máy chủ nối theo thứ tự.
  const [clips, setClips] = useState<Clip[]>([]);
  const [shownClip, setShownClip] = useState(0);
  const clipKey = useRef(0);
  const [edit, setEdit] = useState<EditSpec>(emptyEdit);
  const [seriesId, setSeriesId] = useState('');
  const [episodeNo, setEpisodeNo] = useState(1);
  const [watchOnly, setWatchOnly] = useState(false);
  const [sound, setSound] = useState<PickedSound | null>(
    initialSound ? { sound: initialSound, startSec: 0, volume: 80, originalVolume: 100 } : null,
  );
  const [time, setTime] = useState(0);
  const [look, setLook] = useState<Look>('goc');
  // Stitch: chọn đoạn 1–5 giây của video gốc (SPEC-creator.md V5.5 mục 4).
  const [stitchFrom, setStitchFrom] = useState(0);
  const [stitchLen, setStitchLen] = useState(3);
  const stitchMaxLen = stitch ? Math.max(1, Math.min(5, Math.floor(stitch.durationSec - stitchFrom))) : 5;
  const stitchRef = useRef<HTMLVideoElement>(null);
  const [beauty, setBeauty] = useState(0);
  const lookCss =
    [CSS_LOOKS[look] === 'none' ? '' : CSS_LOOKS[look], cssBeauty(beauty)].filter(Boolean).join(' ') ||
    'none';
  const recordedClips = clips.filter((c) => c.recorded);
  const recordedSec = recordedClips.reduce((sum, c) => sum + (c.seconds ?? 0), 0);
  const ready = Boolean(file || clips.length);
  const editing = cameraOn && mode === 'video' && !duet && !stitch && ready;
  const totalSec = file
    ? durationSec
    : clips.length && clips.every((c) => c.seconds !== null)
      ? clips.reduce((sum, c) => sum + c.seconds!, 0)
      : null;
  const shown = file ? null : (clips[shownClip] ?? null);
  const shownOffset = clips.slice(0, shownClip).reduce((sum, c) => sum + (c.seconds ?? 0), 0);
  const shownBlob = shown?.blob;
  const shownSpeed = shown?.speed ?? 1;

  // Khung xem trước chiếu đoạn đang chọn đúng tốc độ đã quay; chữ và nhãn dán hiện theo giây của video ghép.
  useEffect(() => {
    const v = preview.current;
    if (!v || !shownBlob) return;
    const url = URL.createObjectURL(shownBlob);
    v.onloadedmetadata = null;
    v.src = url;
    v.defaultPlaybackRate = shownSpeed;
    v.playbackRate = shownSpeed;
    return () => URL.revokeObjectURL(url);
  }, [shownBlob, shownSpeed]);

  const newClip = (
    blob: Blob,
    name: string,
    speed: number,
    seconds: number | null,
    recorded: boolean,
  ): Clip => ({
    key: ++clipKey.current,
    name,
    blob,
    speed,
    seconds,
    recorded,
  });

  // Thời lượng file chọn thêm đo bằng thẻ video ẩn (máy chủ đo lại khi ghép).
  // Giữ tham chiếu tới thẻ đang đo: thẻ không gắn vào trang có thể bị dọn trước khi đọc xong.
  const measuring = useRef(new Set<HTMLVideoElement>());
  const setClipSeconds = (key: number, sec: number) =>
    setClips((list) => list.map((c) => (c.key === key && c.seconds === null ? { ...c, seconds: sec } : c)));
  function measure(clip: Clip) {
    const v = document.createElement('video');
    const url = URL.createObjectURL(clip.blob);
    const done = () => {
      measuring.current.delete(v);
      URL.revokeObjectURL(url);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) setClipSeconds(clip.key, v.duration / clip.speed);
      done();
    };
    v.onerror = done;
    measuring.current.add(v);
    v.src = url;
    v.load();
  }

  function joinClips(base: Clip[], added: Clip[]) {
    const list = [...base, ...added];
    const files = list.filter((c) => !c.recorded).length;
    if (list.length > MAX_JOIN_PARTS || files > MAX_CLIPS)
      return setError(t('post.edit.tooManyClips', { max: MAX_CLIPS }));
    if (list.reduce((sum, c) => sum + c.blob.size, 0) > MAX_JOIN_BYTES)
      return setError(t('post.err.TOO_LARGE'));
    setError(null);
    setFile(null);
    setClips(list);
    setEdit((e) => ({ ...e, trimStart: 0, trimEnd: null }));
    list.filter((c) => c.seconds === null).forEach(measure);
  }

  // Đổi thứ tự / bỏ một đoạn ghép.
  const moveClip = (index: number, by: -1 | 1) =>
    setClips((list) => {
      const next = [...list];
      const [c] = next.splice(index, 1);
      next.splice(Math.min(next.length, Math.max(0, index + by)), 0, c!);
      return next;
    });
  const currentAsClips = () => (file ? [newClip(file, file.name, 1, durationSec, false)] : clips);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/video/products?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { items: PickableProduct[] }) => setResults(d.items))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (cameraOn && clips.length) return joinClips(clips, [newClip(f, f.name, 1, null, false)]);
    setClips([]);
    setEdit(emptyEdit());
    setDurationSec(null);
    if (f.size > limits.maxBytes)
      return setError(
        limits.long
          ? t('post.err.tooBigMb', { mb: Math.round(limits.maxBytes / 1024 / 1024) })
          : t('post.err.tooBig'),
      );
    setFile(f);
    // Kiểm sơ bộ thời lượng trên máy (server kiểm lại bằng ffprobe). Trình duyệt không đọc được thì bỏ qua.
    const url = URL.createObjectURL(f);
    const v = preview.current;
    if (v) {
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration)) setDurationSec(v.duration);
        if (v.duration > maxSec(mode) + 0.5) setError(t('post.err.tooLong', { sec: maxSec(mode) }));
      };
      v.src = url;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || error) return;
    const asDraft = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'draft';
    setProgress(0);
    const messages = { failed: t('post.err.upload'), offline: t('post.err.offline') };
    const up = clips.length
      ? await postRecording(clips, setProgress, messages)
      : !file
        ? { ok: false, message: messages.failed }
        : limits.long
          ? await chunkedUpload(
              file,
              durationSec,
              (p) => {
                setProgress(p.pct);
                setDetail(p);
              },
              messages,
            )
          : await putWithProgress(file, setProgress, messages);
    setDetail(null);
    if (!up.ok || !up.uploadId) {
      setProgress(null);
      return setError(up.message ?? t('post.err.upload'));
    }
    const result = await createVideoAction({
      uploadId: up.uploadId,
      caption,
      productIds: picked.map((p) => p.id),
      kind: mode,
      duetOfId: duet?.id ?? null,
      stitch: stitch
        ? { ofId: stitch.id, fromSec: stitchFrom, toSec: stitchFrom + Math.min(stitchLen, stitchMaxLen) }
        : null,
      options:
        postOptions && mode === 'video'
          ? {
              visibility,
              ...allow,
              province,
              placeName,
              aiGenerated: aiUsed,
              draft: asDraft,
              publishAt: !asDraft && scheduleAt ? `${scheduleAt}:00+07:00` : null,
            }
          : undefined,
      autoCaptions: captionsOn && mode === 'video' && autoCaptions,
      look: cameraOn && mode === 'video' ? look : undefined,
      beauty: cameraOn && mode === 'video' ? beauty : undefined,
      editSpec: editing ? edit : undefined,
      series:
        seriesId && mode === 'video' && !duet && !stitch ? { id: seriesId, episodeNo, watchOnly } : null,
      sound:
        cameraOn && mode === 'video' && !duet && !stitch && sound
          ? {
              id: sound.sound.id,
              startSec: sound.startSec,
              volume: sound.volume,
              originalVolume: sound.originalVolume,
            }
          : null,
    });
    setProgress(null);
    if (result?.error) setError(result.error);
  }

  const toggle = (p: PickableProduct) =>
    setPicked((list) =>
      list.some((x) => x.id === p.id)
        ? list.filter((x) => x.id !== p.id)
        : list.length < 3
          ? [...list, p]
          : list,
    );

  const field =
    'rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-brand';
  return (
    <form
      onSubmit={submit}
      // Ô nhập và nút trong các nhóm (không phải nút đăng ở thanh dính) được cuộn tới phải nằm trên thanh nút dính ở đáy và menu dưới (không bị che trên điện thoại).
      className="flex flex-col gap-4 [&_fieldset]:min-w-0 [&_fieldset_button]:scroll-mb-44 [&_input]:scroll-mb-44 [&_select]:scroll-mb-44 [&_textarea]:scroll-mb-44"
    >
      {stitch ? (
        <fieldset
          className="flex flex-col gap-2 rounded-[16px] border border-brand/40 bg-white/5 p-3"
          data-testid="stitch-picker"
        >
          <legend className="px-1 font-black">✂️ {t('post.stitchWith', { name: stitch.author })}</legend>
          <video
            ref={stitchRef}
            src={stitch.fileUrl}
            muted
            playsInline
            className="mx-auto max-h-48 rounded-[12px] bg-black"
            onLoadedMetadata={(e) => (e.currentTarget.currentTime = stitchFrom)}
          />
          <label className="flex items-center gap-3 text-[12px] font-bold text-white/70">
            {t('post.stitchFrom', { sec: stitchFrom.toFixed(1) })}
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor((stitch.durationSec - 1) * 2) / 2)}
              step={0.5}
              value={stitchFrom}
              onChange={(e) => {
                setStitchFrom(Number(e.target.value));
                if (stitchRef.current) stitchRef.current.currentTime = Number(e.target.value);
              }}
              className="flex-1 accent-[#ff6b00]"
              data-testid="stitch-from"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('post.stitchLength')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={Math.min(stitchLen, stitchMaxLen) === n}
                disabled={n > stitchMaxLen}
                onClick={() => setStitchLen(n)}
                className={`h-8 rounded-full border px-3 text-[12px] font-bold disabled:opacity-30 ${Math.min(stitchLen, stitchMaxLen) === n ? 'border-brand bg-brand text-white' : 'border-white/15 text-white/70'}`}
                data-testid={`stitch-len-${n}`}
              >
                {n}s
              </button>
            ))}
          </div>
          <span className="text-[12px] text-white/60">{t('post.stitchHint')}</span>
        </fieldset>
      ) : duet ? (
        <div
          className="flex items-center gap-3 rounded-[16px] border border-brand/40 bg-white/5 p-3"
          data-testid="duet-banner"
        >
          <span className="relative h-16 w-10 shrink-0 overflow-hidden rounded-[8px] bg-black">
            {duet.posterUrl ? (
              <Image src={duet.posterUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-black">
              <Repeat2 className="h-4 w-4 text-brand" aria-hidden />{' '}
              {t('post.duetWith', { name: duet.author })}
            </span>
            <span className="block text-[12px] text-white/60">{t('post.duetHint')}</span>
          </span>
        </div>
      ) : (
        <div className="flex gap-2" role="radiogroup">
          {(['video', 'story'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`h-9 rounded-full border px-4 text-[12px] font-bold ${
                mode === m ? 'border-brand bg-brand text-white' : 'border-white/15 bg-white/5 text-white/70'
              }`}
            >
              {t(m === 'video' ? 'post.mode.video' : 'post.mode.story')}
            </button>
          ))}
        </div>
      )}
      {mode === 'story' ? <p className="text-[12px] text-white/60">{t('post.storyHint')}</p> : null}
      {error ? (
        <p
          role="alert"
          data-testid="video-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {error}
        </p>
      ) : null}
      {recorderOpen ? (
        <CameraRecorder
          maxSec={maxSec('video')}
          filter={lookCss}
          onClose={() => setRecorderOpen(false)}
          onDone={(segments) => {
            setRecorderOpen(false);
            // Quay lại thì thay các đoạn quay cũ, giữ các file đã chọn để ghép.
            joinClips(
              currentAsClips().filter((c) => !c.recorded),
              segments.map((s) => newClip(s.blob, '', s.speed, s.seconds / s.speed, true)),
            );
          }}
        />
      ) : null}
      {cameraOn && canRecord && mode === 'video' && !duet ? (
        <button
          type="button"
          onClick={() => setRecorderOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-white/10 font-black"
          data-testid="camera-open"
        >
          📷 {recordedClips.length ? t('post.camera.again') : t('post.camera.open')}
        </button>
      ) : null}
      {recordedClips.length ? (
        <p
          className="rounded-[14px] bg-white/5 px-4 py-3 text-center text-[13px] font-bold"
          data-testid="recorded-info"
        >
          {t('post.camera.recorded', { count: recordedClips.length, sec: recordedSec.toFixed(1) })}
        </p>
      ) : null}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-brand/60 bg-white/5 p-6 text-center font-bold">
        <span aria-hidden className="text-3xl">
          🎬
        </span>
        {file ? file.name : t('post.pick', { sec: maxSec(mode) })}
        <input
          type="file"
          accept={
            limits.long
              ? 'video/mp4,video/quicktime,video/webm,video/x-msvideo,.avi'
              : 'video/mp4,video/quicktime,video/webm'
          }
          className="sr-only"
          data-testid="video-input"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>
      {editing && clips.length ? (
        <fieldset className="flex flex-col gap-2" data-testid="edit-clips">
          <legend className="mb-1 text-[12px] font-bold text-white/70">
            {t('post.edit.clips', { count: clips.length })}
          </legend>
          <ol className="flex flex-col gap-1.5">
            {clips.map((c, i) => (
              <li
                key={c.key}
                className={`flex items-center gap-1 rounded-[12px] border px-2 text-[12px] ${i === shownClip ? 'border-brand bg-brand/10' : 'border-white/10 bg-white/5'}`}
                data-testid="edit-clip"
              >
                <button
                  type="button"
                  onClick={() => setShownClip(i)}
                  className="flex h-10 min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="font-black tabular-nums">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {c.recorded ? t('post.edit.clipRecorded', { n: i + 1 }) : c.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/60">
                    {c.seconds !== null ? `${c.seconds.toFixed(1)}s` : '…'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => moveClip(i, -1)}
                  disabled={i === 0}
                  aria-label={t('post.edit.moveUp')}
                  className="h-9 w-9 shrink-0 rounded-full font-black disabled:opacity-30"
                  data-testid="edit-clip-up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveClip(i, 1)}
                  disabled={i === clips.length - 1}
                  aria-label={t('post.edit.moveDown')}
                  className="h-9 w-9 shrink-0 rounded-full font-black disabled:opacity-30"
                  data-testid="edit-clip-down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClips((list) => list.filter((x) => x.key !== c.key));
                    setShownClip(0);
                    setEdit((e) => ({ ...e, trimStart: 0, trimEnd: null }));
                  }}
                  aria-label={t('post.edit.remove')}
                  className="h-9 w-9 shrink-0 rounded-full font-black"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          <span className="text-[11px] text-white/50">{t('post.edit.joinHint', { sec: limits.maxSec })}</span>
        </fieldset>
      ) : null}
      {editing && clips.filter((c) => !c.recorded).length + (file ? 1 : 0) < MAX_CLIPS ? (
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/15 bg-white/5 text-[13px] font-black">
          ＋ {t('post.edit.addClip')}
          <input
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/webm"
            className="sr-only"
            data-testid="edit-add-clip"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length)
                joinClips(
                  currentAsClips(),
                  files.map((f) => newClip(f, f.name, 1, null, false)),
                );
            }}
          />
        </label>
      ) : null}
      <EditOverlay
        spec={editing ? edit : emptyEdit()}
        time={time}
        onMove={(kind, index, x, y) =>
          setEdit((e) => ({ ...e, [kind]: e[kind].map((it, i) => (i === index ? { ...it, x, y } : it)) }))
        }
      >
        <video
          ref={preview}
          className="mx-auto max-h-64 rounded-[14px]"
          style={{ filter: lookCss }}
          muted
          playsInline
          controls
          hidden={!file && !clips.length}
          onTimeUpdate={(e) => setTime(shownOffset + e.currentTarget.currentTime / shownSpeed)}
          onLoadedMetadata={(e) => {
            const sec = e.currentTarget.duration;
            if (shown && Number.isFinite(sec)) setClipSeconds(shown.key, sec / shown.speed);
          }}
          data-testid="video-preview"
        />
      </EditOverlay>
      {editing ? (
        <EditPanel
          spec={edit}
          duration={totalSec}
          onChange={(next) => {
            // Kéo thanh cắt đầu thì khung xem trước nhảy tới chỗ đó (video một file).
            if (file && preview.current && next.trimStart !== edit.trimStart)
              preview.current.currentTime = next.trimStart;
            setEdit(next);
          }}
        />
      ) : null}
      {cameraOn && mode === 'video' ? (
        <fieldset className="flex min-w-0 flex-col gap-2" data-testid="video-looks">
          <legend className="mb-1 text-[12px] font-bold text-white/70">{t('post.look.title')}</legend>
          <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup">
            {LOOKS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={look === l}
                onClick={() => setLook(l)}
                data-testid={`look-${l}`}
                className={`h-9 shrink-0 rounded-full border px-3 text-[12px] font-bold ${look === l ? 'border-brand bg-brand text-white' : 'border-white/15 bg-white/5 text-white/70'}`}
              >
                {t(`post.look.${l}`)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-[12px] font-bold text-white/70">
            {t('post.beauty', { level: beauty })}
            <input
              type="range"
              min={0}
              max={MAX_BEAUTY}
              step={1}
              value={beauty}
              onChange={(e) => setBeauty(Number(e.target.value))}
              className="flex-1 accent-[#ff6b00]"
              data-testid="video-beauty"
            />
          </label>
          <p className="text-[11px] text-white/50">{t('post.beautyHint')}</p>
        </fieldset>
      ) : null}
      {cameraOn && mode === 'video' && !duet && !stitch ? (
        <SoundPicker value={sound} onChange={setSound} />
      ) : null}
      {series.length && mode === 'video' && !duet && !stitch ? (
        <fieldset className="flex flex-col gap-2" data-testid="video-series">
          <legend className="mb-1 text-[12px] font-bold text-white/70">🎬 {t('post.series.pick')}</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <select
              value={seriesId}
              onChange={(e) => {
                setSeriesId(e.target.value);
                setEpisodeNo(series.find((s) => s.id === e.target.value)?.next ?? 1);
              }}
              className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
              aria-label={t('post.series.pick')}
              data-testid="video-series-select"
            >
              <option value="">{t('post.series.none')}</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={200}
              value={episodeNo}
              onChange={(e) => setEpisodeNo(Number(e.target.value))}
              disabled={!seriesId}
              aria-label={t('post.series.episodeNo')}
              className={`${field} h-11 w-full min-w-0 py-0 font-normal disabled:opacity-40`}
              data-testid="video-series-episode"
            />
          </div>
          {seriesId ? (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={watchOnly}
                onChange={(e) => setWatchOnly(e.target.checked)}
                className="h-4 w-4 accent-[#ff6b00]"
                data-testid="video-series-watch-only"
              />
              {t('post.series.watchOnly')}
            </label>
          ) : null}
        </fieldset>
      ) : null}
      <label className="flex flex-col gap-1.5 text-[12px] font-bold text-white/70">
        {t('post.caption', { count: caption.length, max: MAX_CAPTION })}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
          rows={3}
          placeholder={t('post.captionPlaceholder')}
          className={`${field} font-normal`}
          data-testid="video-caption"
        />
      </label>
      {postOptions && mode === 'video' ? (
        <fieldset className="flex flex-col gap-2" data-testid="video-privacy">
          <legend className="mb-1 text-[12px] font-bold text-white/70">{t('post.privacy')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {(['public', 'followers', 'private'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={visibility === v}
                onClick={() => setVisibility(v)}
                className={`h-9 rounded-full border px-4 text-[12px] font-bold ${
                  visibility === v
                    ? 'border-brand bg-brand text-white'
                    : 'border-white/15 bg-white/5 text-white/70'
                }`}
              >
                {t(`post.visibility.${v}`)}
              </button>
            ))}
          </div>
          {(['allowComments', 'allowRemix', 'allowDownload'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={allow[k]}
                onChange={(e) => setAllow((a) => ({ ...a, [k]: e.target.checked }))}
                className="h-4 w-4 accent-[#ff6b00]"
              />
              {t(`post.${k}`)}
            </label>
          ))}
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={aiUsed}
              onChange={(e) => setAiUsed(e.target.checked)}
              className="h-4 w-4 accent-[#ff6b00]"
              data-testid="video-ai"
            />
            {t('post.aiUsed')}
          </label>
          <div className="mt-2 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
            <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
              {t('post.province')}
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
                data-testid="video-province"
              >
                <option value="">{t('post.noPlace')}</option>
                {provinces.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
              {t('post.placeName')}
              <input
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                maxLength={60}
                placeholder={t('post.placeNameHint')}
                className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
                data-testid="video-place"
              />
            </label>
          </div>
          <label className="mt-2 flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('post.schedule')}
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
              data-testid="video-schedule"
            />
            <span className="font-normal text-white/50">{t('post.scheduleHint')}</span>
          </label>
        </fieldset>
      ) : null}
      {captionsOn && mode === 'video' ? (
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={autoCaptions}
            onChange={(e) => setAutoCaptions(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#ff6b00]"
            data-testid="video-auto-captions"
          />
          <span>
            <span className="font-bold">{t('post.autoCaptions')}</span>
            <span className="block text-[12px] text-white/50">{t('post.autoCaptionsHint')}</span>
          </span>
        </label>
      ) : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-white/70">
          {t('post.products', { count: picked.length })}
        </legend>
        {picked.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className="h-8 rounded-full bg-brand px-3 text-[12px] font-bold text-white"
                >
                  {p.name} ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('post.productSearch')}
          className={`${field} h-11 rounded-full px-4 py-0`}
          data-testid="video-product-search"
        />
        <ul className="flex flex-col divide-y divide-white/10" data-testid="video-product-results">
          {results.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 py-2 text-left text-[13px]"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
                    {p.thumbUrl ? (
                      <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="text-white/50">
                      {formatVnd(p.price)} · {p.kiotName}
                    </span>
                  </span>
                  <span aria-hidden className={`font-black ${on ? 'text-brand' : ''}`}>
                    {on ? '✓' : '+'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {/* Nút đăng luôn nằm ở đáy màn hình, ngay trên thanh menu dưới: trên iPhone form dài (khung xem trước, danh
          sách sản phẩm) nên nút cuối form bị khuất, người dùng chọn video xong không thấy chỗ bấm đăng. */}
      <div className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 flex flex-col gap-2 border-t border-white/10 bg-ink/95 px-4 py-3 backdrop-blur-xl">
        {progress !== null ? (
          <div className="flex flex-col gap-1" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[12px] text-white/60" data-testid="video-progress">
              {progress >= 100
                ? t('post.saving')
                : detail && detail.bytesPerSec > 0 && detail.etaSec !== null
                  ? t('post.uploadingDetail', {
                      pct: progress,
                      speed: mb(detail.bytesPerSec),
                      eta: clockText(detail.etaSec),
                    })
                  : t('post.uploading', { pct: progress })}
            </span>
          </div>
        ) : null}
        <div className="flex gap-2">
          {postOptions && mode === 'video' ? (
            <button
              type="submit"
              value="draft"
              disabled={!ready || Boolean(error) || progress !== null || remaining[mode] <= 0}
              className="h-12 shrink-0 rounded-full border border-white/20 px-5 font-black text-white disabled:opacity-50"
              data-testid="video-save-draft"
            >
              {t('post.saveDraft')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!ready || Boolean(error) || progress !== null || remaining[mode] <= 0}
            className="h-12 flex-1 rounded-full bg-brand font-black text-white shadow-[0_0_20px_rgb(255_107_0/0.35)] disabled:opacity-50"
          >
            {t(
              mode === 'story'
                ? 'post.submitStory'
                : postOptions && scheduleAt
                  ? 'post.submitScheduled'
                  : 'post.submit',
            )}
          </button>
        </div>
        {/* Nút chưa bấm được thì nói lý do ngay dưới nút (lỗi video quá dài/quá nặng cũng hiện ở đây). */}
        <p className="text-center text-[12px] text-white/50" data-testid="video-submit-hint">
          {!ready && remaining[mode] > 0
            ? t('post.pickFirst')
            : error && progress === null
              ? error
              : t(mode === 'story' ? 'post.remainingStory' : 'post.remaining', { count: remaining[mode] })}
        </p>
      </div>
    </form>
  );
}
