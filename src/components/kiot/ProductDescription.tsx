import { parseDescription } from '@/lib/description';

// Mô tả sản phẩm chia theo mục: tiêu đề in đậm, gạch đầu dòng thành danh sách cho dễ đọc trên điện thoại.
export function ProductDescription({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3 leading-relaxed text-black/85" data-testid="product-description">
      {parseDescription(text).map((block, i) =>
        block.kind === 'heading' ? (
          <h3 key={i} className="mt-2 text-sm font-extrabold uppercase tracking-wide text-brand-deep">
            {block.text}
          </h3>
        ) : block.kind === 'list' ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
