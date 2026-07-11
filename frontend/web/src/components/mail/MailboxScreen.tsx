'use client';

import { useState } from 'react';
import { useEmail } from '@/hooks/useEmail';
import { EmailList } from '@/components/mail/EmailList';
import { EmailView } from '@/components/mail/EmailView';
import { EmailSummary, mailApi } from '@/lib/api';
import { MAILBOX_LABELS } from '@/lib/constants';

export function MailboxScreen({ mailbox }: { mailbox: string }) {
  const { emails, loading, refresh, loadDetail } = useEmail(mailbox);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [selectedId, setSelectedId] = useState<string>();

  const handleSelect = async (email: EmailSummary) => {
    setSelectedId(email.id);
    // loadDetail fetches the full message AND caches its body locally so the
    // Smart Inbox (AI) and the local FTS5 search get the real content.
    const full = await loadDetail(email.id);
    setSelected(full);
    if (!email.isRead) {
      await mailApi.markRead(email.id, true);
      refresh();
    }
  };

  const handleDelete = async (id: string) => {
    await mailApi.remove(id);
    setSelected(null);
    setSelectedId(undefined);
    refresh();
  };

  return (
    <div className="flex h-full">
      <div className="w-[380px] shrink-0 overflow-auto border-r border-border privmail-scroll">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          {MAILBOX_LABELS[mailbox] ?? mailbox}
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Lädt…</p>
        ) : (
          <EmailList emails={emails} selectedId={selectedId} onSelect={handleSelect} />
        )}
      </div>
      <div className="flex-1 overflow-auto privmail-scroll">
        <EmailView email={selected as never} onDelete={handleDelete} />
      </div>
    </div>
  );
}
