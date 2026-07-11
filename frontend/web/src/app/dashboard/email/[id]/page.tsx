'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { mailApi } from '@/lib/api';
import { EmailView } from '@/components/mail/EmailView';

export default function EmailDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [email, setEmail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    mailApi.get(id).then((res) => setEmail(res.email)).catch(() => setEmail(null));
  }, [id]);

  return (
    <div className="h-full overflow-auto">
      <EmailView email={email as never} />
    </div>
  );
}
