'use server';

import { redirect } from 'next/navigation';
import { endSession } from '@/modules/identity';

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect('/');
}
