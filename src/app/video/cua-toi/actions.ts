'use server';

import { revalidatePath } from 'next/cache';
import { deleteVideo } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

export async function deleteVideoAction(form: FormData): Promise<void> {
  const user = await requireUser();
  await deleteVideo(String(form.get('videoId') ?? ''), user.id);
  revalidatePath('/video/cua-toi');
}
