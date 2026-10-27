import { getSetting } from './settings';
import { cached } from './ttl-cache';

// Thông tin pháp lý hiện ở chân trang và trang Giới thiệu; CEO sửa ở /admin/noi-dung (SPEC-admin.md bổ sung 27/10).
export type LegalInfo = {
  company: string;
  taxId: string;
  office: string;
  showroom: string;
  hotline: string;
  email: string;
};

export const LEGAL_DEFAULTS: LegalInfo = {
  company: '9MUA CO.,LTD',
  taxId: '3401295437',
  office: '115 Nguyễn Hậu, P. Phú Thọ Hòa, TP.HCM',
  showroom: 'Lô 26, đường ven biển Hamubay, Tiến Thành, Phan Thiết',
  hotline: '0979393916',
  email: 'ceo@9mua.com',
};

export const LEGAL_FIELDS = Object.keys(LEGAL_DEFAULTS) as (keyof LegalInfo)[];

export function parseLegal(json: string): LegalInfo {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    /* dùng mặc định */
  }
  const out = { ...LEGAL_DEFAULTS };
  for (const f of LEGAL_FIELDS) {
    const v = raw[f];
    if (typeof v === 'string' && v.trim()) out[f] = v.trim().slice(0, 200);
  }
  return out;
}

export const getLegalInfo = () =>
  cached('legal-info', 30, async () => parseLegal(await getSetting('legal_info_json')));
