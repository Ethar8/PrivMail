'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { generateKeyPair } from '@/lib/pgp';
import { Lock, Copy } from 'lucide-react';

interface EncryptionSettingsProps {
  user?: { id: string; email: string; displayName: string | null };
}

export function EncryptionSettings({ user }: EncryptionSettingsProps) {
  const [passphrase, setPassphrase] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const pair = await generateKeyPair(
        user.displayName ?? user.email,
        user.email,
        passphrase,
      );
      setPublicKey(pair.publicKey);
      setPrivateKey(pair.privateKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPublic = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <Lock size={18} /> PGP-Schlüsselpaar erzeugen
        </h3>
        <p className="text-sm text-muted-foreground">
          Erstelle ein OpenPGP-Schlüsselpaar für Ende-zu-Ende-verschlüsselte E-Mails.
        </p>
        <Input
          type="password"
          placeholder="Passphrase für den privaten Schlüssel"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="max-w-md"
        />
        <div>
          <Button onClick={handleGenerate} disabled={generating || !passphrase}>
            <Lock size={16} /> {generating ? 'Wird erzeugt…' : 'Schlüsselpaar erzeugen'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {publicKey && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Öffentlicher Schlüssel</label>
            <Button variant="ghost" size="sm" onClick={handleCopyPublic}>
              <Copy size={14} /> {copied ? 'Kopiert!' : 'Kopieren'}
            </Button>
          </div>
          <Textarea
            value={publicKey}
            readOnly
            rows={8}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Teile diesen öffentlichen Schlüssel mit deinen Kontakten, damit sie dir verschlüsselte E-Mails senden können.
          </p>
        </div>
      )}
    </div>
  );
}
