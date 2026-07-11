'use client';

import { DomainList } from '@/components/admin/DomainList';
import { DnsCheck } from '@/components/admin/DnsCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDomainsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Domänenverwaltung</h1>

      <DnsCheck />

      <Card>
        <CardHeader>
          <CardTitle>Domänen</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainList />
        </CardContent>
      </Card>
    </div>
  );
}
