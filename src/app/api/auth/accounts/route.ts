import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { endAllSavedSessions, endSession, stashCurrentAccount, switchAccount } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Nhiều tài khoản trên một máy (SPEC-identity.md V5.5). Form gửi thẳng tới đây (không qua server action) để trình duyệt
// tải lại cả trang: header, giỏ hàng, thông báo lấy lại theo tài khoản mới.
export async function POST(request: Request) {
  const app = env().APP_URL;
  const go = (path: string) => Response.redirect(`${app}${path}`, 303);
  if (!(await isFeatureOn('account_more'))) return go('/');
  const form = await request.formData().catch(() => null);
  const action = String(form?.get('action') ?? '');
  if (action === 'switch') {
    const ok = await switchAccount(String(form?.get('userId') ?? ''));
    return go(ok ? '/tai-khoan' : '/dang-nhap');
  }
  if (action === 'add') {
    const r = await stashCurrentAccount();
    return go(r.ok ? '/dang-nhap?next=%2Ftai-khoan&them-tai-khoan=1' : `/tai-khoan?loi-tai-khoan=${r.error}`);
  }
  if (action === 'logout-all') {
    await endAllSavedSessions();
    await endSession();
    return go('/');
  }
  return go('/tai-khoan');
}
