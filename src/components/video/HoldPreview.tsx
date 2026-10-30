'use client';

import Image from 'next/image';
import { useState } from 'react';

// Ảnh xem trước động 3 giây (SPEC-creator.md V5.1 mục 7): hiện khi di chuột hoặc giữ ngón tay trên ô video ở lưới.
// Chỉ tải ảnh khi người dùng chạm / di chuột tới, không tải sẵn cho cả lưới.
export function HoldPreview({ url }: { url: string }) {
  const [on, setOn] = useState(false);
  const show = () => setOn(true);
  const hide = () => setOn(false);
  return (
    <span
      className="absolute inset-0 [-webkit-touch-callout:none]"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onTouchStart={show}
      onTouchEnd={hide}
      onTouchCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="grid-preview"
    >
      {on ? (
        <Image src={url} alt="" fill sizes="33vw" className="object-cover" draggable={false} unoptimized />
      ) : null}
    </span>
  );
}
