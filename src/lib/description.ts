// Tách mô tả sản phẩm (chữ người bán gõ) thành khối để hiện cho dễ đọc: dòng IN HOA ngắn mở đầu một đoạn
// là tiêu đề mục, dòng bắt đầu bằng "•" hoặc "-" là gạch đầu dòng, còn lại giữ nguyên như người bán viết.
export type DescriptionBlock =
  { kind: 'heading'; text: string } | { kind: 'list'; items: string[] } | { kind: 'text'; text: string };

const BULLET = /^[•-]\s+/;

function isHeading(line: string): boolean {
  return line.length <= 60 && line === line.toLocaleUpperCase('vi') && line !== line.toLocaleLowerCase('vi');
}

export function parseDescription(description: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const paragraph of description.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const lines = paragraph
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1 && isHeading(lines[0]!)) blocks.push({ kind: 'heading', text: lines.shift()! });
    let current: DescriptionBlock | null = null;
    for (const line of lines) {
      const bullet = BULLET.test(line);
      if (bullet && current?.kind === 'list') current.items.push(line.replace(BULLET, ''));
      else if (!bullet && current?.kind === 'text') current.text += `\n${line}`;
      else {
        current = bullet ? { kind: 'list', items: [line.replace(BULLET, '')] } : { kind: 'text', text: line };
        blocks.push(current);
      }
    }
  }
  return blocks;
}
