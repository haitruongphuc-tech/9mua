import { describe, expect, it } from 'vitest';
import { LEGAL_DEFAULTS, parseLegal } from './legal';

describe('parseLegal', () => {
  it('ô trống hoặc JSON hỏng thì dùng mặc định', () => {
    expect(parseLegal('{}')).toEqual(LEGAL_DEFAULTS);
    expect(parseLegal('khong-phai-json')).toEqual(LEGAL_DEFAULTS);
    expect(parseLegal('{"hotline":"  ","email":"hai@9mua.com"}')).toEqual({
      ...LEGAL_DEFAULTS,
      email: 'hai@9mua.com',
    });
  });
});
