// Dịch một khoá, thay {bien} bằng giá trị. Thiếu bản dịch thì dùng tiếng Việt; không bao giờ trả về mã khoá.
export type Vars = Record<string, string | number>;

export function translate(
  dict: Record<string, string>,
  fallback: Record<string, string>,
  key: string,
  vars?: Vars,
): string {
  const text = dict[key] || fallback[key] || '';
  return vars
    ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
    : text;
}

// Lấy các khoá bắt đầu bằng một trong các tiền tố, để chỉ gửi xuống trình duyệt phần chữ trang cần.
export function pickMessages(
  dict: Record<string, string>,
  prefixes: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(dict)) if (prefixes.some((p) => k.startsWith(p))) out[k] = v;
  return out;
}
