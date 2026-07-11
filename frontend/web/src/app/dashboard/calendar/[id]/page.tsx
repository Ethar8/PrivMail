'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const handleDelete = async () => {
    await api.del(`/calendar/${id}`);
    router.push('/dashboard/calendar');
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Termin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            🔒 Die Termindetails sind Ende-zu-Ende verschlüsselt und werden lokal entschlüsselt.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard/calendar')}>
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
