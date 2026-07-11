'use client';

import { useRouter } from 'next/navigation';
import { ComposeForm } from '@/components/mail/ComposeForm';

export default function ComposePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-semibold">Neue E-Mail</h1>
      <ComposeForm onSent={() => router.push('/dashboard/inbox?mailbox=Sent')} />
    </div>
  );
}
