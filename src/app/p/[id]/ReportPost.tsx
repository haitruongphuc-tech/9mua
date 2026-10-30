'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';

const REASONS = ['noi_dung_xau', 'lua_dao', 'ban_quyen', 'khac'] as const;

// Báo cáo bài viết (SPEC-creator.md V5.10 mục 3): lý do như video.
export function ReportPost({ postId }: { postId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <p role="status" className="text-[12px] font-bold text-green-300">
        {t('feed.post.reportSent')}
      </p>
    );
  return open ? (
    <div className="flex flex-col gap-1" data-testid="post-report-reasons">
      {REASONS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={async () => {
            const ok = await fetch(`/api/posts/${postId}/report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: r }),
            })
              .then((x) => x.ok)
              .catch(() => false);
            if (ok) setDone(true);
          }}
          className="h-10 rounded-[12px] bg-white/5 px-3 text-left text-[13px] font-bold"
        >
          {t(`feed.reportReason.${r}`)}
        </button>
      ))}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-fit text-[12px] font-bold text-white/60"
      data-testid="post-report"
    >
      ⚑ {t('feed.post.report')}
    </button>
  );
}
