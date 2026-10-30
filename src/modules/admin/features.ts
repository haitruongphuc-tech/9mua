import { audit } from '@/lib/audit';
import {
  featureStates,
  isFeatureName,
  isFeatureOn,
  missingKeys,
  saveFeature,
  FEATURES,
} from '@/lib/features';
import type { AdminResult } from './accounts';
import { currentCommitment, publishCommitment } from '@/modules/identity';
import { verifyTotp } from './totp';

export { featureStates };

// Bật/tắt công tắc chức năng (SPEC-admin.md V5.0). Thiếu khoá dịch vụ thì không bật được; công tắc đụng tiền phải nhập
// mã xác thực 2 lớp khi bật. Mỗi lần đổi ghi 1 dòng nhật ký CEO có trước/sau.
export async function setFeatureSwitch(
  adminId: string,
  name: string,
  on: boolean,
  totpCode: string,
): Promise<AdminResult> {
  if (!isFeatureName(name)) return { ok: false, error: 'Không có công tắc này.' };
  const before = await isFeatureOn(name);
  if (on) {
    const missing = missingKeys(name);
    if (missing.length) return { ok: false, error: `Chưa có khoá: ${missing.join(', ')}` };
    if (FEATURES[name].money) {
      if (!totpCode.trim())
        return { ok: false, error: 'Công tắc này đụng tiền: nhập mã xác thực 2 lớp để bật.' };
      const check = await verifyTotp(adminId, totpCode.trim());
      if (!check.ok) return { ok: false, error: 'Mã xác thực không đúng.' };
    }
  }
  await saveFeature(name, on, adminId);
  await audit({
    adminId,
    action: 'feature.set',
    targetType: 'feature',
    targetId: name,
    before: { on: before },
    after: { on: await isFeatureOn(name) },
  });
  return { ok: true, message: `${on ? 'Đã bật' : 'Đã tắt'}: ${FEATURES[name].label}.` };
}

// CEO sửa chữ cam kết nội dung (SPEC-identity.md V5.6): tạo bản mới, mọi người được hỏi lại; ghi nhật ký CEO.
export async function publishCommitmentText(adminId: string, lines: string[]): Promise<AdminResult> {
  const before = await currentCommitment();
  const r = await publishCommitment(adminId, lines);
  if (!r.ok) return { ok: false, error: 'Cần đủ 4 dòng, mỗi dòng tối đa 200 ký tự.' };
  await audit({
    adminId,
    action: 'commitment.publish',
    targetType: 'commitment',
    targetId: String(r.version),
    before,
    after: await currentCommitment(),
  });
  return { ok: true, message: `Đã đăng cam kết bản ${r.version}. Mọi người sẽ được hỏi lại.` };
}
