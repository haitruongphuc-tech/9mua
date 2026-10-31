'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { disconnectNetwork, importPages, lookupPages, type ImportNetwork } from '@/modules/social';

// Nhập Page đã tick (SPEC-kiot.md V5.4). "Chọn tất cả" lấy mọi Page vừa tìm được.
export async function importPagesAction(network: ImportNetwork, q: string, form: FormData): Promise<void> {
  const user = await requireUser();
  if (!(await isFeatureOn('page_import'))) redirect('/ket-noi');
  const ids =
    form.get('all') === 'on'
      ? (await lookupPages(network, q)).map((p) => p.externalId)
      : form.getAll('id').map(String);
  const r = await importPages(user.id, network, q, ids, Boolean(await getKiotByOwner(user.id)));
  redirect(r.ok ? '/ket-noi?da-nhap=1#nhap-page' : `/ket-noi?loi-nhap=${r.error}#nhap-page`);
}

export async function disconnectNetworkAction(network: ImportNetwork): Promise<void> {
  const user = await requireUser();
  await disconnectNetwork(user.id, network);
  redirect('/ket-noi#nhap-page');
}
