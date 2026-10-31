import type { SocialModes } from '@/components/auth/SocialButtons';
import { isFeatureOn } from '@/lib/features';
import { googleMode, oauthMode } from '@/modules/identity';

// Nút đăng nhập nào đang bật (đã có khoá, hoặc màn hình giả trên máy E2E). Apple còn cần công tắc apple_login.
export async function socialModes(): Promise<SocialModes> {
  return {
    zalo: oauthMode('zalo') !== 'off',
    google: googleMode() !== 'off',
    facebook: oauthMode('facebook') !== 'off',
    apple: oauthMode('apple') !== 'off' && (await isFeatureOn('apple_login')),
  };
}
