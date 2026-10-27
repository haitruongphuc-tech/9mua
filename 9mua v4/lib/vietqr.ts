// [PAY-VIETQR] Tạo chuỗi QR chuyển khoản chuẩn VietQR (EMVCo/NAPAS) - quét bằng app ngân hàng
const tlv = (id: string, value: string) => id + value.length.toString().padStart(2, "0") + value;

function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Nội dung chuyển khoản chỉ nên dùng chữ không dấu, số và khoảng trắng
const clean = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 50);

export function vietQR({ bin, account, amount, note }: { bin: string; account: string; amount?: number; note?: string }) {
  const merchant = tlv("00", "A000000727") + tlv("01", tlv("00", bin) + tlv("01", account)) + tlv("02", "QRIBFTTA");
  let s = tlv("00", "01") + tlv("01", amount ? "12" : "11") + tlv("38", merchant) + tlv("53", "704");
  if (amount) s += tlv("54", String(Math.round(amount)));
  s += tlv("58", "VN");
  if (note) s += tlv("62", tlv("08", clean(note)));
  s += "6304";
  return s + crc16(s);
}
