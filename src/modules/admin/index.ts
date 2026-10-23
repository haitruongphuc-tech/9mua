// Module admin (SPEC-admin.md): giao diện + điều phối. Không cung cấp hàm cho module khác.
export {
  requireAdminVerified,
  getVerifiedAdmin,
  markSessionVerified,
  isSessionVerified,
  ADMIN_SESSION_HOURS,
} from './guard';
export {
  getTotpStatus,
  beginTotpSetup,
  confirmTotpSetup,
  verifyTotp,
  backupCodesLeft,
  MAX_FAILED,
  LOCK_MINUTES,
  type VerifyResult,
} from './totp';
export {
  getTodo,
  getMetrics,
  revenueByDay,
  rangeStart,
  RANGES,
  type Range,
  type Metrics,
  type TodoItem,
} from './metrics';
export {
  approvePayout,
  markPayoutTransferred,
  rejectPayoutRequest,
  reviewKycSubmission,
  markOrderRefunded,
  resolveDispute,
  resolveIssue,
  resolveProductReport,
  resolveVideoReport,
} from './queues';
export {
  lockUserAccount,
  unlockUserAccount,
  sendResetLink,
  issueTempPassword,
  lockKiotAccount,
  unlockKiotAccount,
  grantKiotYear,
  adjustKiotBalance,
  updateSettings,
  getAllSettings,
  validateSetting,
  type AdminResult,
} from './accounts';
export { searchUsers, searchKiots, searchOrders } from './search';
export { incomingCsv, outgoingCsv, toCsv, csvCell } from './export';
