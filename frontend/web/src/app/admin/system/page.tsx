'use client';

import { SystemStatus } from '@/components/admin/SystemStatus';
import { AIControlCenter } from '@/components/admin/AIControlCenter';

export default function AdminSystemPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">System</h1>
      <SystemStatus />
      <AIControlCenter />
    </div>
  );
}
