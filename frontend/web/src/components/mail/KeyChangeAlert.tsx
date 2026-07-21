'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KeyChangeAlertProps {
  contactEmail: string;
  oldFingerprint: string;
  newFingerprint: string;
  onTrust: () => void;
  onDismiss: () => void;
}

export function KeyChangeAlert({
  contactEmail,
  oldFingerprint,
  newFingerprint,
  onTrust,
  onDismiss,
}: KeyChangeAlertProps) {
  return (
    <div
      className="mb-4 rounded-[var(--radius)] border border-destructive/50 bg-destructive/10 p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle size={18} aria-hidden="true" />
        Schlüsselwechsel erkannt
      </div>
      <p className="mb-2 text-sm">
        Der PGP-Schlüssel von <strong>{contactEmail}</strong> hat sich geändert – möglicher
        Man-in-the-Middle-Versuch.
      </p>
      <p className="mb-3 font-mono text-xs text-muted-foreground">
        Alt: {oldFingerprint.slice(0, 16)}… → Neu: {newFingerprint.slice(0, 16)}…
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDismiss} aria-label="Nachricht trotzdem anzeigen">
          Trotzdem anzeigen
        </Button>
        <Button size="sm" onClick={onTrust} aria-label="Neuen Schlüssel vertrauen">
          Neuen Schlüssel vertrauen
        </Button>
      </div>
    </div>
  );
}

export function useKeyChangeCheck(contactEmail: string, currentFingerprint: string | null) {
  const [alert, setAlert] = useState<{ old: string; neu: string } | null>(null);

  useEffect(() => {
    if (!contactEmail || !currentFingerprint || typeof window === 'undefined') return;
    const key = `privmail-key-fp:${contactEmail.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (stored && stored !== currentFingerprint) {
      setAlert({ old: stored, neu: currentFingerprint });
    } else if (!stored) {
      localStorage.setItem(key, currentFingerprint);
    }
  }, [contactEmail, currentFingerprint]);

  const trustNewKey = () => {
    if (!contactEmail || !currentFingerprint) return;
    localStorage.setItem(`privmail-key-fp:${contactEmail.toLowerCase()}`, currentFingerprint);
    setAlert(null);
  };

  return { alert, trustNewKey, dismissAlert: () => setAlert(null) };
}
