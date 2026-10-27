import type { Lang } from '@/i18n/config';
import { en } from './en';
import { POLICY_SLUGS, type PolicyDoc, type PolicySet, type PolicySlug } from './types';
import { vi } from './vi';

export { POLICY_SLUGS, POLICY_UPDATED, type PolicyDoc, type PolicySlug } from './types';

// Bản tiếng Việt là bản chính. Các thứ tiếng khác dịch sau khi CEO duyệt bản tiếng Việt (tránh dịch lại nhiều lần);
// chưa có bản dịch thì hiện tiếng Việt kèm một dòng báo (SPEC-i18n.md mục 7).
const DOCS: Partial<Record<Lang, PolicySet>> = { vi, en };

export const isPolicySlug = (v: string): v is PolicySlug => POLICY_SLUGS.some((s) => s === v);

export function policyFor(slug: PolicySlug, lang: Lang): { doc: PolicyDoc; fallback: boolean } {
  const set = DOCS[lang];
  return set ? { doc: set[slug], fallback: false } : { doc: vi[slug], fallback: true };
}

// Thay {company}, {hotline}, {kiotFee}… bằng số liệu thật; chữ lạ giữ nguyên.
export function fillPolicy(doc: PolicyDoc, values: Record<string, string>): PolicyDoc {
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
  return {
    title: fill(doc.title),
    summary: fill(doc.summary),
    sections: doc.sections.map((s) => ({ heading: fill(s.heading), paragraphs: s.paragraphs.map(fill) })),
  };
}
