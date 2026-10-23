'use client';

import { useFormStatus } from 'react-dom';

// Nút gửi form có hỏi xác nhận trước (SPEC-admin.md: hỏi xác nhận trước thao tác tiền hoặc khoá).
export function ConfirmSubmit({
  children,
  confirm,
  tone = 'brand',
  testId,
}: {
  children: React.ReactNode;
  confirm: string;
  tone?: 'brand' | 'danger' | 'plain';
  testId?: string;
}) {
  const { pending } = useFormStatus();
  const color =
    tone === 'danger'
      ? 'border-danger bg-danger text-white'
      : tone === 'plain'
        ? 'border-brand-ink bg-white text-brand-ink'
        : 'border-brand-ink bg-brand text-brand-ink';
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={testId}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className={`h-11 rounded-full border-2 px-4 text-sm font-extrabold disabled:opacity-60 ${color}`}
    >
      {pending ? 'Đang xử lý…' : children}
    </button>
  );
}
