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
// Bổ sung 29/10/2026 (SPEC-identity.md): mã email, Zalo, Facebook, vé liên kết dùng chung.
export {
  requestEmailOtp,
  loginWithEmailOtp,
  addEmailWithOtp,
  setPasswordWithOtp,
  isTemporaryName,
  linkWithOtp,
  linkTicketEmail,
  hasContact,
  type OtpPurpose,
  type OtpRequestResult,
  type OtpLoginResult,
  type AddEmailResult,
  type SetPasswordResult,
  type LinkOtpResult,
} from './otp';
export {
  OAUTH_PROVIDERS,
  oauthMode,
  isOauthProvider,
  startOauthFlow,
  openOauthFlow,
  profileFromCode,
  completeOauthLogin,
  sealFakeOauthCode,
  type OauthProvider,
  type OauthMode,
  type OauthProfile,
  type OauthLoginResult,
} from './oauth';
export { linkWithTicket, openLinkTicket, type LinkProvider } from './link';
