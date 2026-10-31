'use server';

import { redirect } from 'next/navigation';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import {
  approveMember,
  banMember,
  createGroup,
  joinGroup,
  leaveGroup,
  moderateGroupPost,
  postToGroup,
  reportGroup,
  setApprovePosts,
  setGroupAdmin,
} from '@/modules/social';

// Nhóm cộng đồng (SPEC-social.md V5.10), công tắc groups.
async function member() {
  const user = await requireUser();
  if (!(await isFeatureOn('groups'))) redirect('/');
  return user;
}

const back = (groupId: string, q = '') => redirect(`/nhom/${encodeURIComponent(groupId)}${q}`);
const adminBack = (groupId: string) => redirect(`/nhom/${encodeURIComponent(groupId)}/quan-tri`);

export async function createGroupAction(form: FormData): Promise<void> {
  const user = await member();
  const r = await createGroup(user.id, {
    name: String(form.get('name') ?? ''),
    description: String(form.get('description') ?? ''),
    privacy: String(form.get('privacy') ?? ''),
  });
  redirect(r.ok ? `/nhom/${r.groupId}` : `/nhom/tao?loi=${r.error}`);
}

export async function joinGroupAction(groupId: string): Promise<void> {
  const user = await member();
  const r = await joinGroup(user.id, groupId);
  back(groupId, r.ok ? '' : `?loi=${r.error}`);
}

export async function leaveGroupAction(groupId: string): Promise<void> {
  const user = await member();
  await leaveGroup(user.id, groupId);
  back(groupId);
}

export async function postToGroupAction(groupId: string, form: FormData): Promise<void> {
  const user = await member();
  const videoId = String(form.get('videoId') ?? '');
  const r = await postToGroup(
    user.id,
    groupId,
    videoId ? { videoId } : { text: String(form.get('text') ?? '') },
  );
  back(groupId, r.ok ? (r.status === 'pending' ? '?cho-duyet=1' : '') : `?loi=${r.error}`);
}

export async function reportGroupAction(
  groupId: string,
  communityPostId: string | null,
  form: FormData,
): Promise<void> {
  const user = await member();
  await reportGroup(user.id, groupId, String(form.get('reason') ?? 'other'), communityPostId ?? undefined);
  back(groupId, '?da-bao-cao=1');
}

export async function approveMemberAction(groupId: string, userId: string, approve: boolean): Promise<void> {
  const user = await member();
  await approveMember(user.id, groupId, userId, approve);
  adminBack(groupId);
}

export async function banMemberAction(groupId: string, userId: string): Promise<void> {
  const user = await member();
  await banMember(user.id, groupId, userId);
  adminBack(groupId);
}

export async function setGroupAdminAction(groupId: string, userId: string, admin: boolean): Promise<void> {
  const user = await member();
  await setGroupAdmin(user.id, groupId, userId, admin);
  adminBack(groupId);
}

export async function setApprovePostsAction(groupId: string, form: FormData): Promise<void> {
  const user = await member();
  await setApprovePosts(user.id, groupId, form.get('on') === 'on');
  adminBack(groupId);
}

export async function moderateGroupPostAction(
  groupId: string,
  id: string,
  action: 'approve' | 'remove',
): Promise<void> {
  const user = await member();
  await moderateGroupPost(user.id, id, action);
  adminBack(groupId);
}
