'use client';

import { useState, useEffect, useCallback } from 'react';
import { mailApi, EmailSummary } from '@/lib/api';
import { saveEmailLocally, updateEmailBodyLocally } from '@/lib/db';

export function useEmail(mailbox = 'INBOX') {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mailApi.list(mailbox);
      setEmails(res.emails);
      for (const e of res.emails) {
        try {
          // Cache metadata. An empty body here never overwrites a body that
          // was already loaded via the detail view (handled in saveEmailLocally).
          await saveEmailLocally({
            id: e.id,
            messageId: e.id,
            from: e.from,
            to: e.to,
            subject: e.subject,
            body: '',
            receivedAt: new Date(e.receivedAt).getTime(),
            isRead: e.isRead,
            isEncrypted: e.isEncrypted,
            mailbox: e.mailbox,
          });
        } catch {
          /* offline cache best-effort */
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mailbox]);

  /**
   * Loads the full message (including body) from the server and caches the
   * body locally so the Smart Inbox (AI) and the FTS5 full-text search can use
   * the real content. Returns the full email record.
   */
  const loadDetail = useCallback(async (id: string): Promise<Record<string, unknown>> => {
    const res = await mailApi.get(id);
    const email = res.email as Record<string, unknown>;
    const body = typeof email.body === 'string' ? email.body : '';
    if (body) {
      try {
        await updateEmailBodyLocally(id, body);
      } catch {
        /* offline cache best-effort */
      }
    }
    return email;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { emails, loading, error, refresh, loadDetail };
}
