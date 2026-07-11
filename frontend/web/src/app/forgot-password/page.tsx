'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Self-hosted reset flows require admin action; we surface guidance instead
    // of leaking whether an account exists.
    setSubmitted(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Passwort vergessen</CardTitle>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4 text-sm">
              <p>
                Falls ein Konto zu <strong>{email}</strong> existiert, wende dich an deinen
                PrivMail-Administrator, um das Passwort zurückzusetzen.
              </p>
              <Link href="/login" className="text-primary">
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit">Anweisungen anzeigen</Button>
              <Link href="/login" className="text-center text-sm text-primary">
                Zurück zur Anmeldung
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
