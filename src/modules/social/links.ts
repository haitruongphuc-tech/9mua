// Phát hiện link trong bình luận / chat (chống lừa đảo, SPEC-social.md mục 3): http(s)://, www., tên miền dạng
// abc.com / zalo.me/..., kể cả khi viết cách "abc . com" thì không bắt (chấp nhận được).
const URL_LIKE =
  /(https?:\/\/|www\.)|\b[a-z0-9-]{2,}\.(com|vn|net|org|me|io|co|info|biz|xyz|top|shop|site|online|link|app|ly|gl|to|cc|tk)(\b|\/)/i;

export const hasLink = (text: string) => URL_LIKE.test(text);
