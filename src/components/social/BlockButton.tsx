'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/client';

// Nút Chặn / Bỏ chặn dùng ở trang cá nhân, bình luận, live, Cài đặt (SPEC-social.md V5.3). Xong thì gọi onDone
// (mặc định tải lại trang để ẩn nội dung của người bị chặn).
export function BlockButton({
  userId,
  name,
  unblock = false,
  className = 'font-bold underline',
  onDone,
}: {
  userId: string;
  name: string;
  unblock?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!unblock && !window.confirm(t('common.block.confirm', { name }))) return;
    setBusy(true);
    const res = await fetch('/api/social/block', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, unblock }),
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 401) {
      window.location.href = `/dang-nhap?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const data = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (data?.error === 'LIMIT') return toast(t('common.block.limit'));
    if (!data?.ok) return;
    toast(unblock ? t('common.block.unblocked') : t('common.block.done', { name }));
    if (onDone) onDone();
    else window.location.reload();
  }
  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      className={className}
      data-testid={unblock ? 'unblock-button' : 'block-button'}
    >
      {unblock ? t('common.block.unblock') : t('common.block.action')}
    </button>
  );
}
