'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { UserList } from '@/components/admin/UserList';
import { UserForm } from '@/components/admin/UserForm';
import { SetupQrCode } from '@/components/admin/SetupQrCode';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalTrigger } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function AdminUsersPage() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createdUser, setCreatedUser] = useState<{ email: string; displayName?: string } | null>(null);

  const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  const handleCreate = async (data: {
    email: string;
    password: string;
    displayName?: string;
    isAdmin?: boolean;
  }) => {
    await api.post('/admin/users', data);
    setOpen(false);
    setRefreshKey((k) => k + 1);
    // Show the RFC 6186 auto-discovery QR for the freshly created account.
    setCreatedUser({ email: data.email, displayName: data.displayName });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutzerverwaltung</h1>
        <Modal open={open} onOpenChange={setOpen}>
          <ModalTrigger asChild>
            <Button>
              <Plus size={16} /> Nutzer
            </Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Neuen Nutzer anlegen</ModalTitle>
            </ModalHeader>
            <UserForm onSubmit={handleCreate} />
          </ModalContent>
        </Modal>
      </div>

      {createdUser && (
        <Card>
          <CardHeader>
            <CardTitle>Mobil-Einrichtung für {createdUser.email}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <SetupQrCode
              email={createdUser.email}
              domain={domain}
              displayName={createdUser.displayName}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nutzer</CardTitle>
        </CardHeader>
        <CardContent>
          <UserList key={refreshKey} />
        </CardContent>
      </Card>
    </div>
  );
}
