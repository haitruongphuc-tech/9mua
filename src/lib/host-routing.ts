// Định tuyến theo tên miền (SPEC-kiot.md "Định tuyến tên miền phụ"). Hàm thuần để test đủ mọi trường hợp.
export type RouteDecision =
  | { type: 'next' }
  | { type: 'rewrite'; pathname: string }
  | { type: 'redirect'; url: string }
  | { type: 'not-found' };

const PASSTHROUGH =
  /^\/(api|_next|uploads|brand)\/|^\/(favicon\.ico|apple-touch-icon\.png|icon-[\w-]+\.png|manifest\.webmanifest|robots\.txt|og-default\.png)$/;
const KIOT_PAGE = /^\/(p\/[^/]+)?$/;
const LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function routeRequest(
  req: { host: string; pathname: string; search: string },
  appUrl: string,
): RouteDecision {
  const app = new URL(appUrl);
  const host = req.host.toLowerCase();
  if (host === app.host) return { type: 'next' };
  if (host === `www.${app.host}`)
    return { type: 'redirect', url: `${app.origin}${req.pathname}${req.search}` };
  if (!host.endsWith(`.${app.host}`)) return { type: 'next' };

  const slug = host.slice(0, -(app.host.length + 1));
  if (!LABEL.test(slug)) return { type: 'not-found' };
  if (PASSTHROUGH.test(req.pathname)) return { type: 'next' };
  if (KIOT_PAGE.test(req.pathname))
    return { type: 'rewrite', pathname: `/k/${slug}${req.pathname === '/' ? '' : req.pathname}` };
  // Đăng nhập, giỏ hàng, Chợ… luôn nằm ở tên miền chính.
  return { type: 'redirect', url: `${app.origin}${req.pathname}${req.search}` };
}
