// Kết quả thao tác hiện ở đầu trang hàng chờ (Server Action chuyển về kèm ?xong=… hoặc ?loi=…).
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (ok)
    return (
      <p
        role="status"
        data-testid="flash-ok"
        className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
      >
        {ok}
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        data-testid="flash-error"
        className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
      >
        {error}
      </p>
    );
  return null;
}
