'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    authApi
      .setupRequired()
      .then(async (res) => {
        if (res.setupRequired) {
          router.replace('/setup');
          return;
        }
        try {
          await authApi.me();
          router.replace('/dashboard/inbox');
        } catch {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">PrivMail wird geladen…</p>
    </main>
  );
}
