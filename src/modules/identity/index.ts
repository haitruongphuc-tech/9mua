// Hợp đồng public của module identity (SPEC-identity.md). Module khác chỉ import từ file này.
export { register, type RegisterResult } from './register';
export { login, type LoginResult } from './login';
export {
  requestPasswordReset,
  completePasswordReset,
  type CompleteResetResult,
  type ResetEmailCopy,
} from './reset';
export { normalizeIdentifier, type Identifier } from './identifier';
export {
  getCurrentUser,
  getCurrentSessionId,
  requireUser,
  requireAdmin,
  startSession,
  endSession,
  hasSessionCookie,
} from './current-user';
export {
  updateProfile,
  changeEmail,
  changePassword,
  verifyUserPassword,
  passwordFingerprint,
} from './account';
export { invalidateOtherSessions } from './session';
export { lockUser, unlockUser, resetPassword, createAdmin, type CreateAdminResult } from './admin';
export {
  googleMode,
  startGoogleFlow,
  openGoogleFlow,
  claimsFromCode,
  completeGoogleLogin,
  linkGoogleWithTicket,
  sealFakeGoogleCode,
  type GoogleMode,
} from './google';
export type { SessionUser } from './types';
