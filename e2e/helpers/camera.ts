import type { Page } from '@playwright/test';

// Trình duyệt chỉ mở camera trên trang https; máy test chạy http://9mua.test nên thay camera bằng hình vẽ canvas
// (chỉ trong E2E). RTCPeerConnection vẫn chạy thật.
export async function fakeCamera(target: Page) {
  await target.addInitScript(() => {
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') return;
    const getUserMedia = async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
      // Chromium chạy ẩn chỉ sinh khung hình cho canvas đã gắn vào trang (MediaRecorder ghi 0 byte nếu không gắn).
      canvas.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none';
      document.body.append(canvas);
      const ctx = canvas.getContext('2d')!;
      let n = 0;
      setInterval(() => {
        ctx.fillStyle = `hsl(${(n += 7) % 360} 80% 50%)`;
        ctx.fillRect(0, 0, 360, 640);
      }, 100);
      const stream = canvas.captureStream(15);
      // Tiếng giả phải có nguồn phát: track tiếng im hoàn toàn làm MediaRecorder chờ mãi và ghi 0 byte.
      const ac = new AudioContext();
      const audio = ac.createMediaStreamDestination();
      const tone = ac.createOscillator();
      tone.connect(audio);
      tone.start();
      audio.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      return stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });
}
