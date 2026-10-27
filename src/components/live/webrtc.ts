// Gửi hình (WHIP) và nhận hình (WHEP) với MediaMTX bằng fetch + RTCPeerConnection có sẵn trong trình duyệt
// (SPEC-live.md: không thêm thư viện npm). Không dùng "trickle ICE": chờ gom ứng viên tối đa 2 giây rồi gửi một lần.

// fake: máy chủ hình giả của E2E (không có kết nối hình thật để đo).
export type MediaSession = { pc: RTCPeerConnection; fake: boolean; close: () => Promise<void> };

function waitIce(pc: RTCPeerConnection, ms = 2_000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, ms);
  });
}

async function negotiate(
  pc: RTCPeerConnection,
  url: string,
  token: string,
): Promise<{ resource: string | null; fake: boolean }> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIce(pc);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/sdp', authorization: `Bearer ${token}` },
    body: pc.localDescription?.sdp ?? offer.sdp ?? '',
  });
  if (res.status === 401 || res.status === 403) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const location = res.headers.get('location');
  // Máy chủ hình giả của E2E không trả SDP; máy chủ thật luôn trả.
  const fake = Boolean(res.headers.get('x-fake-media'));
  if (!fake) await pc.setRemoteDescription({ type: 'answer', sdp: await res.text() });
  const resource = location
    ? new URL(location, url.startsWith('http') ? url : window.location.href).toString()
    : null;
  return { resource, fake };
}

function closer(pc: RTCPeerConnection, resource: string | null) {
  return async () => {
    pc.getSenders().forEach((s) => s.track?.stop());
    pc.close();
    if (resource) await fetch(resource, { method: 'DELETE' }).catch(() => {});
  };
}

// Người phát: hình dọc tối đa 720×1280, 30 khung/giây, 1,5 Mbps; tiếng Opus.
export async function publish(url: string, token: string, stream: MediaStream): Promise<MediaSession> {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  for (const track of stream.getTracks()) {
    const t = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
    if (track.kind === 'video') {
      const params = t.sender.getParameters();
      params.encodings = [{ maxBitrate: 1_500_000, maxFramerate: 30 }];
      await t.sender.setParameters(params).catch(() => {});
    }
  }
  const { resource, fake } = await negotiate(pc, url, token);
  return { pc, fake, close: closer(pc, resource) };
}

// Người xem: chỉ nhận hình và tiếng.
export async function play(url: string, token: string, video: HTMLVideoElement): Promise<MediaSession> {
  const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });
  const remote = new MediaStream();
  pc.addEventListener('track', (e) => {
    remote.addTrack(e.track);
    if (video.srcObject !== remote) video.srcObject = remote;
  });
  const { resource, fake } = await negotiate(pc, url, token);
  return { pc, fake, close: closer(pc, resource) };
}

export function cameraConstraints(facing: 'user' | 'environment'): MediaStreamConstraints {
  return {
    video: {
      facingMode: facing,
      width: { ideal: 720 },
      height: { ideal: 1280 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: { echoCancellation: true, noiseSuppression: true },
  };
}
