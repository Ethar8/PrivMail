import { authApi, setToken, clearToken, AuthUser } from './api';

export type { AuthUser } from './api';

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await authApi.login(email, password);
  setToken('cookie-managed');
  return res.user;
}

export async function setup(email: string, password: string, displayName?: string): Promise<AuthUser> {
  const res = await authApi.setup(email, password, displayName);
  setToken('cookie-managed');
  return res.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await authApi.me();
    return res.user;
  } catch {
    clearToken();
    return null;
  }
}

export function logout(): void {
  clearToken();
}

export function isAuthenticated(): boolean {
  // httpOnly cookie cannot be read from JS synchronously.
  return true;
}
