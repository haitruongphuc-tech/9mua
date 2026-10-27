import { I18nProvider } from './client';
import { getLang, messagesFor } from './server';

// Server Component: gửi thêm nhóm chữ cho các Client Component bên trong (vd. prefixes={['feed.']}).
export async function ClientMessages({
  prefixes,
  children,
}: {
  prefixes: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <I18nProvider lang={await getLang()} messages={await messagesFor(prefixes)}>
      {children}
    </I18nProvider>
  );
}
