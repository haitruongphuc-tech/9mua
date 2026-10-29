import { Prisma } from '@prisma/client';
import { alertCeo } from '@/lib/alerts';
import { audit } from '@/lib/audit';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { activeBan, isMember, otherOf } from './access';
import {
  AUTO_BAN_MS,
  AUTO_BAN_REPORTERS,
  AUTO_BAN_WINDOW_MS,
  REPORT_REASONS,
  type MessageReportReason,
} from './rules';
import { peers, toViews, type ConversationPeer, type MessageView } from './view';

// Báo cáo cuộc trò chuyện (SPEC-messages.md mục 7). Mỗi người báo 1 lần mỗi cuộc. 3 người khác nhau báo cáo cùng một
// người trong 7 ngày thì người đó tự bị cấm nhắn tin 1 ngày và CEO nhận email.
export async function reportConversation(
  userId: string,
  conversationId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  if (!REPORT_REASONS.includes(reason as MessageReportReason)) return { ok: false };
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || !isMember(c, userId)) return { ok: false };
  const reportedUserId = otherOf(c, userId);
  const at = now();
  try {
    await db.messageReport.create({
      data: { conversationId, reporterId: userId, reportedUserId, reason, createdAt: at },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false };
    throw e;
  }
  const reporters = await db.messageReport.findMany({
    where: { reportedUserId, createdAt: { gt: new Date(at.getTime() - AUTO_BAN_WINDOW_MS) } },
    distinct: ['reporterId'],
    select: { reporterId: true },
  });
  if (reporters.length >= AUTO_BAN_REPORTERS && !(await activeBan(reportedUserId))) {
    await db.messageBan.create({
      data: {
        userId: reportedUserId,
        until: new Date(at.getTime() + AUTO_BAN_MS),
        reason: `Tự động: ${reporters.length} người báo cáo trong 7 ngày`,
        createdAt: at,
      },
    });
    await alertCeo(
      'messages_reported',
      `Tài khoản ${reportedUserId} bị ${reporters.length} người báo cáo tin nhắn trong 7 ngày, đã tự cấm nhắn tin 1 ngày. Xem /admin/tin-nhan.`,
    );
  }
  return { ok: true };
}

export type ReportedConversation = {
  conversationId: string;
  reportedUser: ConversationPeer;
  reports: number;
  reasons: string[];
  lastReportAt: string;
  handled: boolean;
};

// Trang CEO chỉ thấy cuộc trò chuyện BỊ BÁO CÁO: chưa xử lý lên đầu.
export async function listReportedConversations(): Promise<ReportedConversation[]> {
  const rows = await db.messageReport.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  const byConv = new Map<string, typeof rows>();
  for (const r of rows) byConv.set(r.conversationId, [...(byConv.get(r.conversationId) ?? []), r]);
  const people = await peers(rows.map((r) => r.reportedUserId));
  return [...byConv.entries()]
    .map(([conversationId, list]) => ({
      conversationId,
      reportedUser: people.get(list[0]!.reportedUserId) ?? {
        id: list[0]!.reportedUserId,
        displayName: '',
        kiotName: null,
      },
      reports: list.length,
      reasons: [...new Set(list.map((r) => r.reason))],
      lastReportAt: list[0]!.createdAt.toISOString(),
      handled: list.every((r) => r.handledAt),
    }))
    .sort((a, b) => Number(a.handled) - Number(b.handled) || b.lastReportAt.localeCompare(a.lastReportAt));
}

// 50 tin gần nhất tính tới lúc bị báo cáo (kể cả tin đã ẩn), chỉ khi cuộc trò chuyện có báo cáo.
export async function reportedConversationDetail(conversationId: string): Promise<{
  conversationId: string;
  users: ConversationPeer[];
  reports: { reporterId: string; reason: string; createdAt: string; handled: boolean }[];
  messages: MessageView[];
} | null> {
  const reports = await db.messageReport.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
  });
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || reports.length === 0) return null;
  const rows = await db.message.findMany({
    where: { conversationId, createdAt: { lte: reports[0]!.createdAt } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const people = await peers([c.userAId, c.userBId]);
  return {
    conversationId,
    users: [c.userAId, c.userBId].map((id) => people.get(id) ?? { id, displayName: '', kiotName: null }),
    reports: reports.map((r) => ({
      reporterId: r.reporterId,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      handled: Boolean(r.handledAt),
    })),
    messages: await toViews(rows.reverse(), true),
  };
}

export async function hideMessage(
  adminId: string,
  messageId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const m = await db.message.findUnique({ where: { id: messageId } });
  if (!m || m.hiddenAt) return { ok: false };
  await db.message.update({ where: { id: messageId }, data: { hiddenAt: now(), hiddenReason: reason } });
  await audit({ adminId, action: 'messages.hide', targetType: 'message', targetId: messageId, reason });
  return { ok: true };
}

export async function banFromMessages(
  adminId: string,
  userId: string,
  days: number | 'forever',
  reason: string,
): Promise<{ ok: boolean }> {
  const at = now();
  const until = days === 'forever' ? null : new Date(at.getTime() + days * 86_400_000);
  await db.messageBan.create({ data: { userId, until, reason, byAdminId: adminId, createdAt: at } });
  await audit({
    adminId,
    action: 'messages.ban',
    targetType: 'user',
    targetId: userId,
    reason,
    after: { until: until?.toISOString() ?? 'forever' },
  });
  return { ok: true };
}

export async function markReportsHandled(adminId: string, conversationId: string): Promise<{ ok: boolean }> {
  const { count } = await db.messageReport.updateMany({
    where: { conversationId, handledAt: null },
    data: { handledAt: now() },
  });
  if (count)
    await audit({
      adminId,
      action: 'messages.handled',
      targetType: 'conversation',
      targetId: conversationId,
    });
  return { ok: count > 0 };
}

export const hasActiveMessageBan = activeBan;
