import { spawn } from 'node:child_process';

// Chạy ffprobe/ffmpeg bằng spawn với MẢNG tham số cố định (không qua shell, không ghép chuỗi lệnh từ dữ liệu người
// dùng). Dùng chung cho video (creator) và video AI Studio (ai).
export class ToolError extends Error {}

export function runTool(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < 10_000) stderr += d.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new ToolError(`Không chạy được ${cmd}: ${e.message}`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal === 'SIGKILL') return reject(new ToolError(`${cmd} chạy quá ${timeoutMs / 1000} giây`));
      if (code !== 0) return reject(new ToolError(`${cmd} lỗi (${code}): ${stderr.trim().slice(-500)}`));
      resolve({ stdout, stderr });
    });
  });
}
