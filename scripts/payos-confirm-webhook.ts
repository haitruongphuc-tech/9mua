// Đăng ký URL webhook với PayOS (chạy 1 lần khi deploy):
//   docker compose run --rm app node dist/scripts/payos-confirm-webhook.mjs https://9mua.com/api/payos/webhook
import { gateway } from '@/modules/payments/gateway';

async function main() {
  const url = process.argv[2];
  if (!url || !url.startsWith('https://')) {
    console.error('Dùng: payos-confirm-webhook https://9mua.com/api/payos/webhook');
    process.exit(2);
  }
  await gateway().confirmWebhook(url);
  console.log(`Đã đăng ký webhook PayOS: ${url}`);
}

main().catch((error) => {
  console.error('Không đăng ký được webhook:', error instanceof Error ? error.message : error);
  process.exit(1);
});
