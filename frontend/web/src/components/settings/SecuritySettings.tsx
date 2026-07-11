'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { registerWebAuthn, isWebAuthnAvailable } from '@/lib/webauthn';
import { Shield, Key } from 'lucide-react';

interface SecuritySettingsProps {
  user?: { id: string; email: string; displayName: string | null };
}

export function SecuritySettings({ user }: SecuritySettingsProps) {
  const [webauthnMsg, setWebAuthnMsg] = useState<string | null>(null);
  const [webauthnError, setWebAuthnError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleRegisterWebAuthn = async () => {
    if (!user) return;
    setWebAuthnMsg(null);
    setWebAuthnError(null);
    try {
      await registerWebAuthn(user.id, user.displayName ?? user.email);
      setWebAuthnMsg('Sicherheitsschlüssel erfolgreich registriert.');
    } catch (err) {
      setWebAuthnError((err as Error).message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      const { api } = await import('@/lib/api');
      await api.post('/auth/change-password', {
        email: user?.email,
        currentPassword,
        newPassword,
      });
      setPasswordMsg('Passwort erfolgreich geändert.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Shield size={18} /> Zwei-Faktor-Authentifizierung
        </h3>
        {isWebAuthnAvailable() ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Registriere einen Sicherheitsschlüssel (z.B. YubiKey) für hardwarebasierte Zwei-Faktor-Authentifizierung.
            </p>
            <div>
              <Button onClick={handleRegisterWebAuthn}>
                <Key size={16} /> Sicherheitsschlüssel registrieren
              </Button>
            </div>
            {webauthnMsg && <p className="text-sm text-green-600">{webauthnMsg}</p>}
            {webauthnError && <p className="text-sm text-destructive">{webauthnError}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">WebAuthn wird in diesem Browser nicht unterstützt.</p>
        )}
      </div>

      <div>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Key size={18} /> Passwort ändern
        </h3>
        <form onSubmit={handleChangePassword} className="flex max-w-md flex-col gap-3">
          <Input
            type="email"
            placeholder="E-Mail"
            value={user?.email ?? ''}
            disabled
          />
          <Input
            type="password"
            placeholder="Aktuelles Passwort"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Neues Passwort"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <div>
            <Button type="submit">Passwort ändern</Button>
          </div>
          {passwordMsg && <p className="text-sm text-green-600">{passwordMsg}</p>}
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
        </form>
      </div>
    </div>
  );
}
