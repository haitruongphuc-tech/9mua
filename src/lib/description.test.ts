import { describe, expect, it } from 'vitest';
import { parseDescription } from './description';

describe('parseDescription', () => {
  it('tách đoạn mở đầu, tiêu đề IN HOA và gạch đầu dòng', () => {
    const text =
      'Xoài chín cây, ngọt thanh.\n\nĐIỂM NỔI BẬT\n• Chín cây\n• Thịt dày\n\nTHÔNG TIN SẢN PHẨM\n- Khối lượng: 1kg';
    expect(parseDescription(text)).toEqual([
      { kind: 'text', text: 'Xoài chín cây, ngọt thanh.' },
      { kind: 'heading', text: 'ĐIỂM NỔI BẬT' },
      { kind: 'list', items: ['Chín cây', 'Thịt dày'] },
      { kind: 'heading', text: 'THÔNG TIN SẢN PHẨM' },
      { kind: 'list', items: ['Khối lượng: 1kg'] },
    ]);
  });

  it('giữ nguyên mô tả viết tay không có mục, kể cả xuống dòng', () => {
    expect(parseDescription('Hàng mới về.\nGiao nhanh.\r\n\r\n\r\nLiên hệ shop.')).toEqual([
      { kind: 'text', text: 'Hàng mới về.\nGiao nhanh.' },
      { kind: 'text', text: 'Liên hệ shop.' },
    ]);
  });

  it('không coi số hay dòng IN HOA quá dài là tiêu đề', () => {
    const shout = 'HÀNG CHÍNH HÃNG GIÁ TỐT NHẤT THỊ TRƯỜNG CAM KẾT HOÀN TIỀN GẤP ĐÔI NẾU PHÁT HIỆN HÀNG GIẢ';
    expect(parseDescription(`100%\n${shout}`)).toEqual([{ kind: 'text', text: `100%\n${shout}` }]);
  });

  it('mô tả rỗng thì không có gì', () => {
    expect(parseDescription('  \n ')).toEqual([]);
  });
});
