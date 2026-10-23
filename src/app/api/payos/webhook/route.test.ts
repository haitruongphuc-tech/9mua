import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/payos/webhook', () => {
  it('body không phải JSON → 400', async () => {
    const res = await POST(new Request('http://x/api/payos/webhook', { method: 'POST', body: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('JSON sai chữ ký → 400', async () => {
    const res = await POST(
      new Request('http://x/api/payos/webhook', {
        method: 'POST',
        body: JSON.stringify({ data: { orderCode: 1 }, signature: 'x' }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
