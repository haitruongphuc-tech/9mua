export type SessionUser = {
  id: string;
  displayName: string;
  role: 'user' | 'admin';
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
};
