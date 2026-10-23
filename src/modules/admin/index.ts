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
