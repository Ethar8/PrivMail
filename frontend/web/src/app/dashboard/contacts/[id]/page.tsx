'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const handleDelete = async () => {
    await api.del(`/contacts/${id}`);
    router.push('/dashboard/contacts');
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Kontakt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            🔒 Die Kontaktdaten sind Ende-zu-Ende verschlüsselt und werden lokal entschlüsselt.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/contacts')}>
              Zurück
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
