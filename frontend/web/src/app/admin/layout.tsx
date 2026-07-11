'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Header } from '@/components/ui/header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!user.isAdmin) router.replace('/dashboard/inbox');
    else setReady(true);
  }, [user, loading, router]);

  if (!ready) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onLogout={() => { logout(); router.replace('/login'); }} />
        <main className="flex-1 overflow-auto privmail-scroll">{children}</main>
      </div>
    </div>
  );
}
