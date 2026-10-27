import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fillPolicy, isPolicySlug, policyFor, POLICY_SLUGS } from './index';
import { vi } from './vi';

describe('trang chính sách', () => {
  it('đủ 7 trang, bản tiếng Anh cùng số mục với bản tiếng Việt', () => {
    expect(POLICY_SLUGS).toHaveLength(7);
    for (const slug of POLICY_SLUGS) {
      expect(en[slug].sections.length, slug).toBe(vi[slug].sections.length);
      en[slug].sections.forEach((s, i) =>
        expect(s.paragraphs.length, `${slug} mục ${i + 1}`).toBe(vi[slug].sections[i]!.paragraphs.length),
      );
    }
  });

  it('chỉ dùng các chỗ thay số liệu đã biết (không lộ {abc} ra trang)', () => {
    const known = [
      'company',
      'taxId',
      'office',
      'hotline',
      'email',
      'kiotFee',
      'platformFee',
      'payoutMin',
      'payoutFee',
    ];
    for (const set of [vi, en])
      for (const doc of Object.values(set)) {
        const text = JSON.stringify(doc);
        for (const m of text.matchAll(/\{(\w+)\}/g)) expect(known, m[0]).toContain(m[1]);
      }
  });

  it('thay số liệu thật; thứ tiếng chưa dịch thì hiện tiếng Việt và báo', () => {
    const doc = fillPolicy(policyFor('thanh-toan', 'vi').doc, {
      platformFee: '5%',
      payoutMin: '50.000đ',
      payoutFee: '0đ',
      kiotFee: '26.000đ',
    });
    expect(JSON.stringify(doc)).toContain('phí sàn 5%');
    expect(JSON.stringify(doc)).not.toMatch(/\{\w+\}/);
    expect(policyFor('bao-mat', 'en')).toMatchObject({ fallback: false, doc: { title: 'Privacy policy' } });
    expect(policyFor('bao-mat', 'ja')).toMatchObject({ fallback: true, doc: { title: vi['bao-mat'].title } });
    expect(isPolicySlug('bao-mat')).toBe(true);
    expect(isPolicySlug('../admin')).toBe(false);
  });
});
