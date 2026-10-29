'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';

// Tài khoản tạo bằng Zalo/Google/Facebook/mã email có mật khẩu ngẫu nhiên không ai biết (SPEC-identity.md bổ sung
// 29/10). Các thao tác cần mật khẩu (tài khoản nhận tiền, đổi email, đổi mật khẩu) chỉ tới mục "Đặt mật khẩu mới" (mã email).
export function NoPasswordHint({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const t = useT();
  return (
    <p
      className={`text-[12px] ${tone === 'dark' ? 'text-white/50' : 'text-black/60'}`}
      data-testid="no-password-hint"
    >
      {t('common.noPassword')}{' '}
      <Link href="/tai-khoan/cai-dat#dat-mat-khau" className="font-bold text-brand">
        {t('common.setPassword')}
      </Link>
    </p>
  );
}
