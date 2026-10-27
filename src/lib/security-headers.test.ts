import { describe, expect, it } from 'vitest';
import { buildCsp, STATIC_SECURITY_HEADERS } from './security-headers';

describe('CSP', () => {
  it('script chỉ theo nonce, cấm nhúng khung, form chỉ gửi về 9mua.com và tên miền phụ', () => {
    const csp = buildCsp('abc123', 'https://9mua.com');
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://9mua.com https://*.9mua.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(buildCsp('x', 'http://9mua.test:3100')).not.toContain('upgrade-insecure-requests');
  });

  it('camera/micro chỉ cho chính trang 9mua (phát live), các quyền khác tắt', () => {
    expect(STATIC_SECURITY_HEADERS['Permissions-Policy']).toBe(
      'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
    );
  });
});
