// Hợp đồng public của module identity (SPEC-identity.md). Module khác chỉ import từ file này.
export { register, type RegisterResult } from './register';
export { login, type LoginResult } from './login';
export { normalizeIdentifier, type Identifier } from './identifier';
export { getCurrentUser, getCurrentSessionId, requireUser, startSession, endSession } from './current-user';
export type { SessionUser } from './types';
