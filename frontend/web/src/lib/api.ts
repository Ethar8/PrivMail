const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const TOKEN_KEY = 'privmail-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}

export const authApi = {
  setupRequired: () => api.get<{ setupRequired: boolean }>('/auth/setup-required'),
  setup: (email: string, password: string, displayName?: string) =>
    api.post<{ user: AuthUser; token: string }>('/auth/setup', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post<{ user: AuthUser; token: string }>('/auth/login', { email, password }),
  register: (email: string, password: string, displayName?: string) =>
    api.post<{ user: AuthUser; token: string }>('/auth/register', { email, password, displayName }),
  me: () => api.get<{ user: AuthUser }>('/auth/me'),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', {}),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean; token: string }>('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) =>
    api.post<{ ok: boolean }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/reset-password', { token, newPassword }),
};

export interface EmailSummary {
  id: string;
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
  isEncrypted: boolean;
  spamScore: number;
  mailbox: string;
}

export const mailApi = {
  mailboxes: () =>
    api.get<{ mailboxes: { name: string; total: number; unseen: number }[] }>('/mail/mailboxes'),
  list: (mailbox = 'INBOX') =>
    api.get<{ emails: EmailSummary[] }>(`/mail?mailbox=${encodeURIComponent(mailbox)}`),
  get: (id: string) => api.get<{ email: Record<string, unknown> }>(`/mail/${id}`),
  markRead: (id: string, read = true) => api.post(`/mail/${id}/read`, { read }),
  remove: (id: string) => api.del(`/mail/${id}`),
  send: (payload: { to: string[]; subject: string; body: string; raw?: string; isEncrypted?: boolean }) =>
    api.post<{ ok: boolean }>('/mail/send', payload),
};

export type DnsCheckStatus = 'ok' | 'warning' | 'missing' | 'error';

export interface DnsCheckItem {
  check: 'MX' | 'SPF' | 'DKIM' | 'DMARC' | 'PTR';
  status: DnsCheckStatus;
  found: string | null;
  detail: string;
  suggestion?: { type: string; host: string; value: string };
}

export interface DnsCheckReport {
  domain: string;
  checkedAt: string;
  items: DnsCheckItem[];
  score: number;
}

export const adminApi = {
  dnsCheck: () => api.get<DnsCheckReport>('/admin/dns-check'),
};

