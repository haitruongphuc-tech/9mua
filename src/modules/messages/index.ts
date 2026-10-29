// Hợp đồng public của module messages (SPEC-messages.md). Module khác chỉ import từ file này.
export {
  openConversation,
  listConversations,
  getConversation,
  getMessages,
  markRead,
  acceptRequest,
  deleteConversation,
  unreadCount,
  type OpenError,
  type ConversationView,
  type ConversationDetail,
} from './conversations';
export { sendMessage, type SendError } from './send';
export { blockUser, unblockUser, listBlocked } from './blocks';
export {
  reportConversation,
  listReportedConversations,
  reportedConversationDetail,
  hideMessage,
  banFromMessages,
  markReportsHandled,
  hasActiveMessageBan,
  type ReportedConversation,
} from './moderation';
export { saveMessageImage, readMessageImage, type ImageUploadError } from './images';
export { REPORT_REASONS, MAX_TEXT, type MessageReportReason } from './rules';
export { productCardOf, type MessageView, type ProductCard, type ConversationPeer } from './view';
