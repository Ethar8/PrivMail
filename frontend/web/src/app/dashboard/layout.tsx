'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';
import { Header } from '@/components/ui/header';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onLogout={handleLogout} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
