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
  clearUserProfile,
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
export { buildDigest, sendDailyDigest, remindRefundAccounts } from './digest';
export {
  ADMIN_DEVICE_COOKIE,
  TRUST_DAYS,
  trustDevice,
  forgetTrustedDevices,
  listTrustedDevices,
} from './devices';
export { pinsOverview, unpin } from './pins';
// Bổ sung 30/10/2026 (SPEC-admin.md V5.0): công tắc chức năng.
export { setFeatureSwitch, featureStates } from './features';
