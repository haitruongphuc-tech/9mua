import type { MessageKey } from '@/i18n/messages/vi';

// 4 dòng cam kết (SPEC-identity.md V5.6): bản mặc định dịch theo ngôn ngữ đang chọn; bản CEO sửa hiện đúng chữ CEO viết.
export function commitmentLines(t: (key: MessageKey) => string, lines: string[] | null): string[] {
  return (
    lines ?? [
      t('common.commit.line1'),
      t('common.commit.line2'),
      t('common.commit.line3'),
      t('common.commit.line4'),
    ]
  );
}
