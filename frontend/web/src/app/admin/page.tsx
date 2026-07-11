'use client';

import { SystemStatus } from '@/components/admin/SystemStatus';

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Admin-Übersicht</h1>
      <SystemStatus />
    </div>
  );
}
