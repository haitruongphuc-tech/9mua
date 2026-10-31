import { Avatar } from '@/components/ui/Avatar';
import type { SavedAccount } from '@/modules/identity';

// "Tài khoản trên máy này" (SPEC-identity.md V5.5): chuyển nhanh, thêm tài khoản (tối đa 3), đăng xuất tất cả.
export function AccountSwitcher({
  accounts,
  canAdd,
  labels,
}: {
  accounts: SavedAccount[];
  canAdd: boolean;
  labels: { title: string; switchTo: string; add: string; logoutAll: string };
}) {
  return (
    <section
      className="mt-6 flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
      data-testid="account-switcher"
    >
      <h2 className="text-[13px] font-black">{labels.title}</h2>
      {accounts.map((a) => (
        <form key={a.userId} action="/api/auth/accounts" method="post">
          <input type="hidden" name="action" value="switch" />
          <input type="hidden" name="userId" value={a.userId} />
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[12px] bg-white/5 px-3 py-2 text-left hover:bg-white/10"
            data-testid="account-switch"
          >
            <Avatar name={a.displayName} url={a.avatarUrl} className="h-8 w-8 text-[13px]" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{a.displayName}</span>
            <span className="text-[11px] text-white/50">{labels.switchTo}</span>
          </button>
        </form>
      ))}
      <div className="flex flex-wrap gap-2">
        {canAdd ? (
          <form action="/api/auth/accounts" method="post">
            <input type="hidden" name="action" value="add" />
            <button
              type="submit"
              className="h-9 rounded-full bg-white/10 px-4 text-[12px] font-black"
              data-testid="account-add"
            >
              ＋ {labels.add}
            </button>
          </form>
        ) : null}
        {accounts.length ? (
          <form action="/api/auth/accounts" method="post">
            <input type="hidden" name="action" value="logout-all" />
            <button
              type="submit"
              className="h-9 rounded-full border border-danger px-4 text-[12px] font-black text-danger"
              data-testid="account-logout-all"
            >
              {labels.logoutAll}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
