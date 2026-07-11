'use client';

import { AIConfig } from '@/components/ai/AIConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AISettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">KI-Assistent</h1>
      <Card>
        <CardHeader>
          <CardTitle>Anbieter konfigurieren</CardTitle>
        </CardHeader>
        <CardContent>
          <AIConfig />
        </CardContent>
      </Card>
    </div>
  );
}
