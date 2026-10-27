'use server';

import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/modules/identity';
import { reportProduct } from '@/modules/marketplace';

export type ReportState = { ok?: string; error?: string };

export async function reportProductAction(
  productId: string,
  _p: ReportState,
  form: FormData,
): Promise<ReportState> {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { error: t('market.report.needLogin') };
  const result = await reportProduct(
    user.id,
    productId,
    String(form.get('reason') ?? ''),
    String(form.get('message') ?? ''),
  );
  if (result.ok) return { ok: t('market.report.thanks') };
  if (result.error === 'INVALID_INPUT') return { error: t('market.report.invalid') };
  if (result.error === 'OWN_PRODUCT') return { error: t('market.report.own') };
  return { error: t('market.report.unavailable') };
}
