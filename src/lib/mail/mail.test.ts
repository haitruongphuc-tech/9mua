import { describe, expect, it } from 'vitest';
import { getOutbox, sendMail } from './index';
import { escapeHtml, renderEmail } from './templates';

describe('mail', () => {
  it('ở môi trường test, thư nằm trong hộp thư giả', async () => {
    await sendMail({ to: 'a@9mua.com', subject: 'Xin chào', html: '<p>Hi</p>', text: 'Hi' });
    expect(getOutbox()).toEqual([expect.objectContaining({ to: 'a@9mua.com', subject: 'Xin chào' })]);
  });

  it('mẫu email có logo, nội dung đã escape và bản text', () => {
    const mail = renderEmail({
      title: 'Đặt lại mật khẩu',
      greeting: 'Chào <b>Hải</b>',
      paragraphs: ['Bấm nút bên dưới.'],
      action: { label: 'Đặt lại mật khẩu', url: 'https://9mua.com/dat-lai-mat-khau?token=abc' },
    });
    expect(mail.html).toContain('/brand/9mua-logo.png');
    expect(mail.html).toContain('Chào &lt;b&gt;Hải&lt;/b&gt;');
    expect(mail.html).toContain('href="https://9mua.com/dat-lai-mat-khau?token=abc"');
    expect(mail.text).toContain('https://9mua.com/dat-lai-mat-khau?token=abc');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});
