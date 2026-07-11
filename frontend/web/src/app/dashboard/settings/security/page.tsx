'use client';

import { useAuth } from '@/hooks/useAuth';
import { SecuritySettings } from '@/components/settings/SecuritySettings';

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Sicherheit</h1>
      <SecuritySettings user={user ?? undefined} />
    </div>
  );
}
