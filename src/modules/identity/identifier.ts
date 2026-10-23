import { z } from 'zod';

export type Identifier =
  | { kind: 'phone'; value: string; where: { phone: string } }
  | { kind: 'email'; value: string; where: { email: string } };

// Di động Việt Nam: 10 số, đầu 03/05/07/08/09.
const VN_MOBILE = /^0[35789]\d{8}$/;
const emailSchema = z.email();

export function normalizeIdentifier(raw: string): Identifier | null {
  const input = raw.trim();
  if (input.includes('@')) {
    const email = input.toLowerCase();
    return emailSchema.safeParse(email).success ? { kind: 'email', value: email, where: { email } } : null;
  }

  let digits = input.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = '0' + digits.slice(3);
  else if (/^84\d{9}$/.test(digits)) digits = '0' + digits.slice(2);
  if (!VN_MOBILE.test(digits)) return null;

  const phone = '+84' + digits.slice(1);
  return { kind: 'phone', value: phone, where: { phone } };
}
