import { expect, test, type Page } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// Đo LCP và CLS (SPEC-marketplace.md mục 8: LCP < 2,5 giây trên 4G, CLS < 0,1) với mạng "4G chậm" như
// Lighthouse (RTT 150ms, 1,6 Mbps) và CPU chậm 4 lần.
async function measure(page: Page, url: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = Math.max(lcp, e.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!e.hadRecentInput) cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve({ lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 }), 300);
      }),
  );
}

test('LCP < 2,5 giây và CLS < 0,1 trên 4G giả lập', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await signUpWithKiot(page, 'Kiot Tốc Độ');
  await activateKiot(slug);
  await createProductViaUi(page, { name: 'Cà phê Đà Lạt tốc độ', price: '120000' });
  const results: Record<string, { lcp: number; cls: number }> = {};
  for (const [name, url] of [
    ['Trang chủ', '/'],
    ['Chợ', '/cho'],
    ['Danh mục', '/cho/nong-san'],
    ['Trang Kiot', `http://${slug}.9mua.test:3100/`],
    ['Feed video', '/video'],
  ] as const) {
    const visitor = await browser.newPage();
    results[name] = await measure(visitor, url);
    await visitor.close();
  }
  console.info('[perf]', JSON.stringify(results));
  for (const [name, r] of Object.entries(results)) {
    expect(r.lcp, `${name} LCP`).toBeLessThan(2500);
    expect(r.cls, `${name} CLS`).toBeLessThan(0.1);
  }
});
