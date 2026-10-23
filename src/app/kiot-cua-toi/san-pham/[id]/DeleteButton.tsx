'use client';

export function DeleteButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Xoá sản phẩm này? Đơn hàng cũ vẫn được giữ.')) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="h-12 w-full rounded-full border-2 border-danger font-extrabold text-danger"
      >
        Xoá sản phẩm
      </button>
    </form>
  );
}
