'use client';

import { useRouter, useParams } from 'next/navigation';
import { ComposeForm } from '@/components/mail/ComposeForm';

export default function ComposeReplyPage() {
  const router = useRouter();
  const params = useParams();
  const replyTo = decodeURIComponent(String(params.reply ?? ''));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Antworten</h1>
      <ComposeForm
        initialTo={replyTo}
        initialSubject="Re: "
        onSent={() => router.push('/dashboard/inbox?mailbox=Sent')}
      />
    </div>
  );
}
