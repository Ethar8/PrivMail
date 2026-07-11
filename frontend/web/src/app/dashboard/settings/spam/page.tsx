'use client';

import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export default function SpamSettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Spam & Tracking</h1>
      <Card>
        <CardHeader>
          <CardTitle>Schutzeinstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Verschlüsselte Nachrichten automatisch entschlüsseln</p>
              <p className="text-xs text-muted-foreground">Lokal mit deinem privaten Schlüssel.</p>
            </div>
            <Switch
              checked={settings.autoDecrypt}
              onCheckedChange={(v) => update({ autoDecrypt: v })}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Der Spam-Filter (SPF/DKIM/DMARC, Bayes, Blacklist, Tracking-Pixel-Entfernung) läuft
            serverseitig beim Empfang. Nachrichten mit hohem Score landen automatisch im Spam-Ordner.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
