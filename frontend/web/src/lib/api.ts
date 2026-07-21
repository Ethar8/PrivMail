const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// Punkt2: JWT wird jetzt im httpOnly-Cookie gespeichert, nicht mehr localStorage
export function getToken(): string | null {
  return null; // Token wird automatisch im Cookie mitgesendet, nicht mehr manuell im Header
}

export function setToken(_token: string): void {
  // Cookie wird vom Server gesetzt, brauchen wir nicht mehr zu speichern
}

export function clearToken(): void {
  // Logout löscht den Cookie über den Server
}

// Hilfsfunktion zum Lesen von Cookies
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Punkt1: CSRF-Token hinzufügen bei allen state-changing Requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || '')) {
    const xsrfToken = getCookie('XSRF-TOKEN');
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }
  }

  const res = await fetch(`${API_URL}/api${path}`, { 
    ...options, 
    headers,
    credentials: 'include' // Cookies automatisch mit senden (für httpOnly-JWT-Cookie)
  });
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
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
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
    api.post<{ user: AuthUser }>('/auth/setup', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post<{ user: AuthUser }>('/auth/login', { email, password }),
  register: (email: string, password: string, displayName?: string) =>
    api.post<{ user: AuthUser }>('/auth/register', { email, password, displayName }),
  me: () => api.get<{ user: AuthUser }>('/auth/me'),
  logout: () => api.post<{ ok: boolean }>('/auth/logout', {}),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', { currentPassword, newPassword }),
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
  threatLevel?: ThreatLevel | null;
}

export type ThreatLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityCheckResult {
  isSafe: boolean;
  threatLevel: ThreatLevel;
  reasons: string[];
  warning: string | null;
}

export const mailApi = {
  mailboxes: () =>
    api.get<{ mailboxes: { name: string; total: number; unseen: number }[] }>('/mail/mailboxes'),
  list: (mailbox = 'INBOX') =>
    api.get<{ emails: EmailSummary[] }>(`/mail?mailbox=${encodeURIComponent(mailbox)}`),
  get: (id: string) => api.get<{ email: Record<string, unknown> }>(`/mail/${id}`),
  securityCheck: (id: string) => api.get<{ securityCheck: SecurityCheckResult }>(`/mail/${id}/security-check`),
  markRead: (id: string, read = true) => api.post(`/mail/${id}/read`, { read }),
  remove: (id: string) => api.del(`/mail/${id}`),
  send: (payload: {
    to: string[];
    subject: string;
    body: string;
    raw?: string;
    isEncrypted?: boolean;
    attachments?: { filename: string; contentType: string; data: string }[];
    from?: string;
  }) =>
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

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export const importApi = {
  mbox: (content: string, mailbox?: string) =>
    api.post<ImportResult>('/import/mbox', { content, mailbox }),
  eml: (content: string, mailbox?: string) =>
    api.post<ImportResult>('/import/eml', { content, mailbox }),
  imap: (config: {
    host: string;
    port: number;
    user: string;
    password: string;
    mailbox?: string;
    useTls?: boolean;
    limit?: number;
  }) => api.post<ImportResult>('/import/imap', config),
  easySwitch: (config: {
    host: string;
    port: number;
    user: string;
    password: string;
    useTls?: boolean;
    limitPerMailbox?: number;
  }) => api.post<{ jobId: string; status: string }>('/import/easy-switch', config),
  job: (id: string) =>
    api.get<{
      job: {
        id: string;
        status: string;
        progress_imported: number;
        progress_total: number;
        progress_skipped: number;
        current_mailbox: string | null;
        error_message: string | null;
        estimatedRemainingSeconds: number | null;
      };
    }>(`/import/jobs/${id}`),
  jobs: () => api.get<{ jobs: unknown[] }>('/import/jobs'),
  vcf: (content: string) => api.post<ImportResult>('/import/vcf', { content }),
  ics: (content: string) => api.post<ImportResult>('/import/ics', { content }),
};

export type AliasRow = {
  id: string;
  alias_email: string;
  label: string | null;
  is_active: boolean;
  mail_count: number;
  created_at: string;
  disabled_at: string | null;
};

export const aliasesApi = {
  list: () => api.get<{ aliases: AliasRow[] }>('/aliases'),
  create: (alias: string, label?: string) =>
    api.post<{ alias: AliasRow }>('/aliases', { alias, label }),
  quick: (label?: string) =>
    api.post<{ alias: AliasRow }>('/aliases', { quick: true, label }),
  patch: (aliasEmail: string, body: { label?: string | null; isActive?: boolean }) =>
    api.patch<{ alias: AliasRow | null }>(`/aliases/${encodeURIComponent(aliasEmail)}`, body),
  remove: (aliasEmail: string) => api.del(`/aliases/${encodeURIComponent(aliasEmail)}`),
};

export const attachmentShareApi = {
  create: (payload: {
    filename: string;
    contentType: string;
    data: string;
    password: string;
    passwordHint?: string;
    expiresIn?: '1h' | '24h' | '7d' | '30d';
  }) =>
    api.post<{ id: string; accessCode: string; linkPath: string; expiresAt: string; viewCount: number }>(
      '/attachment-shares',
      payload,
    ),
  mine: () =>
    api.get<{
      shares: {
        id: string;
        filename: string;
        view_count: number;
        max_views: number;
        expires_at: string;
        created_at: string;
      }[];
    }>('/attachment-shares/mine'),
  meta: (id: string, code: string) =>
    api.get<{
      id: string;
      filename: string;
      contentType: string;
      hasPasswordHint: boolean;
      passwordHint: string | null;
      expiresAt: string;
      viewCount: number;
    }>(`/attachment-shares/${id}?code=${encodeURIComponent(code)}`),
  ciphertext: (id: string, password: string, code: string) =>
    api.post<{
      encryptedPayload: string;
      filename: string;
      contentType: string;
      viewCount: number;
    }>(`/attachment-shares/${id}/ciphertext`, { password, code }),
};

export const externalApi = {
  encrypt: (payload: {
    recipientEmail: string;
    subject?: string;
    body: string;
    password: string;
    passwordHint?: string;
    expiresIn?: '1h' | '24h' | '7d' | '30d';
  }) =>
    api.post<{ id: string; accessCode: string; linkPath: string; expiresAt?: string }>(
      '/external/encrypt',
      payload,
    ),
  meta: (id: string, code: string) =>
    api.get<{
      id: string;
      recipientEmail: string;
      hasPasswordHint: boolean;
      passwordHint: string | null;
      createdAt: string;
      expiresAt: string | null;
    }>(`/external/${id}?code=${encodeURIComponent(code)}`),
  ciphertext: (id: string, password: string, code?: string) =>
    api.post<{ encryptedBody: string; encryptedSubject: string | null; viewCount: number }>(
      `/external/${id}/ciphertext`,
      { password, code },
    ),
};

export const calendarApi = {
  listCalendars: () =>
    api.get<{ calendars: { id: string; name: string; color: string; is_default: boolean }[] }>(
      '/calendar/calendars',
    ),
  createCalendar: (name: string, color: string) =>
    api.post('/calendar/calendars', { name, color }),
  deleteCalendar: (id: string) => api.del(`/calendar/calendars/${id}`),
  listEvents: (calendarIds?: string[]) =>
    api.get<{ events: Record<string, unknown>[] }>(
      calendarIds?.length
        ? `/calendar?calendars=${encodeURIComponent(calendarIds.join(','))}`
        : '/calendar',
    ),
  createEvent: (payload: Record<string, unknown>) => api.post('/calendar', payload),
  deleteEvent: (id: string) => api.del(`/calendar/${id}`),
  attendees: (id: string) =>
    api.get<{ attendees: { email: string; status: string }[] }>(`/calendar/${id}/attendees`),
};

export const filtersApi = {
  list: () =>
    api.get<{
      rules: {
        id: string;
        name: string;
        condition_field: string;
        condition_op: string;
        condition_value: string;
        action: string;
        action_value: string | null;
        is_active: boolean;
      }[];
    }>('/filters'),
  create: (rule: {
    name: string;
    conditionField: string;
    conditionOp: string;
    conditionValue: string;
    action: string;
    actionValue?: string;
  }) => api.post('/filters', rule),
  remove: (id: string) => api.del(`/filters/${id}`),
  update: (id: string, patch: Record<string, unknown>) => api.put(`/filters/${id}`, patch),
};

export const whitelistApi = {
  list: () =>
    api.get<{ whitelist: string[]; blacklist: string[] }>('/admin/whitelist'),
  add: (kind: 'whitelist' | 'blacklist', entry: string) =>
    api.post('/admin/whitelist', { kind, entry }),
  remove: (kind: 'whitelist' | 'blacklist', entry: string) =>
    api.del('/admin/whitelist', { kind, entry }),
};
