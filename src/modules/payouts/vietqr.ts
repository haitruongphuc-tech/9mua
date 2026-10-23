// Chuỗi VietQR theo chuẩn EMVCo của NAPAS (chuyển nhanh 24/7 tới tài khoản).
// Dùng cho nút "Đã chuyển tay": CEO quét bằng app ngân hàng, số tiền và nội dung đã điền sẵn.

const tlv = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

// CRC16-CCITT (poly 0x1021, khởi tạo 0xFFFF) như EMVCo quy định cho trường 63.
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function asciiDescription(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function buildVietQr(input: {
  bin: string;
  accountNumber: string;
  amount: number;
  description: string;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new Error('Số tiền VietQR không hợp lệ');
  const beneficiary = tlv('00', input.bin) + tlv('01', input.accountNumber);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchant) +
    tlv('53', '704') +
    tlv('54', String(input.amount)) +
    tlv('58', 'VN') +
    tlv('62', tlv('08', asciiDescription(input.description))) +
    '6304';
  return body + crc16(body);
}

// Bộ giải TLV một tầng — để test đọc lại chuỗi đã tạo.
export function parseTlv(data: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    const id = data.slice(i, i + 2);
    const len = Number(data.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len)) throw new Error('Chuỗi TLV hỏng');
    out[id] = data.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
