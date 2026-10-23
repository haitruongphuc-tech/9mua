// Tạo hoặc nâng quyền tài khoản CEO. Chạy trên VPS:
//   docker compose run --rm app node dist/scripts/create-admin.mjs --phone 0979393916 --name "Nguyễn Hải"
// Mật khẩu được hỏi ẩn trong terminal, không bao giờ nhận qua tham số dòng lệnh.
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import { db } from '@/lib/db';
import { createAdmin } from '@/modules/identity/admin';

// Một readline dùng chung cho mọi câu hỏi; ký tự gõ vào hiện thành *.
function createPrompter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lines: string[] = [];
  const waiters: ((line: string) => void)[] = [];
  rl.on('line', (line) => (waiters.length ? waiters.shift()!(line) : lines.push(line)));
  rl.on('close', () => waiters.splice(0).forEach((w) => w('')));
  const internal = rl as unknown as { _writeToOutput: (s: string) => void };
  const write = internal._writeToOutput.bind(rl);
  let masking = false;
  internal._writeToOutput = (s: string) => write(masking && !s.includes('\n') ? '*'.repeat(s.length) : s);

  return {
    askHidden(question: string): Promise<string> {
      process.stdout.write(question);
      masking = true;
      return new Promise<string>((resolve) => {
        const done = (line: string) => {
          masking = false;
          process.stdout.write('\n');
          resolve(line);
        };
        if (lines.length) done(lines.shift()!);
        else waiters.push(done);
      });
    },
    close: () => rl.close(),
  };
}

async function main() {
  const { values } = parseArgs({
    options: { phone: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
  });
  const identifier = values.phone ?? values.email;
  if (!identifier) {
    console.error('Dùng: create-admin --phone 0979393916 [--name "Nguyễn Hải"]  hoặc  --email ceo@9mua.com');
    process.exit(2);
  }

  const prompt = createPrompter();
  const password = await prompt.askHidden('Mật khẩu (ít nhất 8 ký tự, bỏ trống nếu tài khoản đã tồn tại): ');
  if (password) {
    const confirm = await prompt.askHidden('Nhập lại mật khẩu: ');
    if (confirm !== password) {
      console.error('Hai mật khẩu không khớp.');
      process.exit(1);
    }
  }

  prompt.close();
  const result = await createAdmin({ identifier, displayName: values.name ?? 'CEO 9MUA', password });
  if (!result.ok) {
    console.error(`Không tạo được: ${result.message}`);
    process.exit(1);
  }
  console.log(
    result.created ? 'Đã tạo tài khoản CEO.' : 'Tài khoản đã tồn tại — đã nâng quyền CEO (giữ mật khẩu cũ).',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
