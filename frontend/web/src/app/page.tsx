'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, getToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    authApi
      .setupRequired()
      .then((res) => {
        if (res.setupRequired) router.replace('/setup');
        else if (getToken()) router.replace('/dashboard/inbox');
        else router.replace('/login');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">PrivMail wird geladen…</p>
    </main>
  );
}
