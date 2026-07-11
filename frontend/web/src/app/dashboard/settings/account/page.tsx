'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Konto</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">E-Mail</label>
            <Input value={user?.email ?? ''} readOnly />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Anzeigename</label>
            <Input value={user?.displayName ?? ''} readOnly />
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            Abmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
