'use client';

import { useAuth } from '@/hooks/useAuth';
import { EncryptionSettings } from '@/components/settings/EncryptionSettings';

export default function EncryptionSettingsPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Verschlüsselung</h1>
      <EncryptionSettings user={user ?? undefined} />
    </div>
  );
}
