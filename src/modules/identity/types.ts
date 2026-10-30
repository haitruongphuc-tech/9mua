export type SessionUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
};
