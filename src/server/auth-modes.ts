import type { SocialModes } from '@/components/auth/SocialButtons';
import { googleMode, oauthMode } from '@/modules/identity';

// Nút đăng nhập nào đang bật (đã có khoá, hoặc màn hình giả trên máy E2E).
export function socialModes(): SocialModes {
  return {
    zalo: oauthMode('zalo') !== 'off',
    google: googleMode() !== 'off',
    facebook: oauthMode('facebook') !== 'off',
  };
}
