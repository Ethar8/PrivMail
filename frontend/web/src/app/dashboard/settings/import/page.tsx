'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Mail, Users, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { importApi } from '@/lib/api';

export default function ImportSettingsPage() {
  const [mboxContent, setMboxContent] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapUser, setImapUser] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    status: string;
    imported: number;
    total: number;
    skipped: number;
    mailbox: string | null;
    eta: number | null;
    error: string | null;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJob = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void importApi.job(id).then((res) => {
        const j = res.job;
        setProgress({
          status: j.status,
          imported: j.progress_imported,
          total: j.progress_total,
          skipped: j.progress_skipped,
          mailbox: j.current_mailbox,
          eta: j.estimatedRemainingSeconds,
          error: j.error_message,
        });
        if (j.status === 'completed' || j.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);
          setStatus(
            j.status === 'completed'
              ? `Easy-Switch fertig: ${j.progress_imported} importiert, ${j.progress_skipped} übersprungen`
              : `Import fehlgeschlagen: ${j.error_message ?? 'unbekannt'}`,
          );
        }
      });
    }, 2000);
  };

  const handleFile = async (file: File, type: 'mbox' | 'eml' | 'vcf' | 'ics') => {
    setBusy(true);
    setStatus(null);
    try {
      const content = await file.text();
      let result;
      if (type === 'mbox') result = await importApi.mbox(content);
      else if (type === 'eml') result = await importApi.eml(content);
      else if (type === 'vcf') result = await importApi.vcf(content);
      else result = await importApi.ics(content);
      setStatus(`${result.imported} importiert, ${result.skipped} übersprungen`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleEasySwitch = async () => {
    setBusy(true);
    setStatus(null);
    setProgress(null);
    try {
      const res = await importApi.easySwitch({
        host: imapHost,
        port: 993,
        user: imapUser,
        password: imapPassword,
        useTls: true,
      });
      setJobId(res.jobId);
      setStatus('Easy-Switch läuft im Hintergrund – Sie können weiterarbeiten.');
      pollJob(res.jobId);
    } catch (err) {
      setStatus((err as Error).message);
      setBusy(false);
    }
  };

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.imported / progress.total) * 100))
      : progress?.status === 'running'
        ? 5
        : 0;

  return (
    <div className="max-w-2xl space-y-8" role="main" aria-label="Import-Einstellungen">
      <div>
        <h1 className="text-2xl font-semibold">Import / Easy-Switch</h1>
        <p className="text-sm text-muted-foreground">
          Ordnerstruktur und Labels von Gmail, Outlook oder Thunderbird per IMAP übernehmen.
          Der Import läuft als Hintergrund-Job.
        </p>
      </div>

      <section aria-labelledby="import-easy">
        <h2 id="import-easy" className="mb-2 flex items-center gap-2 font-medium">
          <RefreshCw size={16} aria-hidden="true" /> Easy-Switch (alle Ordner)
        </h2>
        <div className="grid gap-2">
          <Input placeholder="IMAP-Server (z. B. imap.gmail.com)" value={imapHost} onChange={(e) => setImapHost(e.target.value)} aria-label="IMAP-Server" />
          <Input placeholder="Benutzername" value={imapUser} onChange={(e) => setImapUser(e.target.value)} aria-label="IMAP-Benutzername" />
          <Input type="password" placeholder="Passwort / App-Passwort" value={imapPassword} onChange={(e) => setImapPassword(e.target.value)} aria-label="IMAP-Passwort" />
          <Button disabled={busy || !imapHost || !imapUser} onClick={() => void handleEasySwitch()}>
            Easy-Switch starten
          </Button>
        </div>
        {progress && (
          <div className="mt-4 space-y-2" role="status" aria-live="polite">
            <div className="h-2 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Status: {progress.status}
              {progress.mailbox ? ` · Ordner: ${progress.mailbox}` : ''} · {progress.imported}
              {progress.total ? ` / ~${progress.total}` : ''} importiert
              {progress.skipped ? `, ${progress.skipped} übersprungen` : ''}
              {progress.eta != null ? ` · ca. ${progress.eta}s verbleibend` : ''}
            </p>
            {jobId && <p className="text-xs text-muted-foreground">Job-ID: {jobId}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="import-mbox">
        <h2 id="import-mbox" className="mb-2 flex items-center gap-2 font-medium">
          <Mail size={16} aria-hidden="true" /> MBOX / EML
        </h2>
        <Input
          type="file"
          accept=".mbox,.eml,.mbx"
          aria-label="MBOX- oder EML-Datei auswählen"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f, f.name.endsWith('.eml') ? 'eml' : 'mbox');
          }}
        />
        <Textarea
          className="mt-2 font-mono text-xs"
          rows={4}
          placeholder="Oder MBOX-Inhalt einfügen…"
          value={mboxContent}
          onChange={(e) => setMboxContent(e.target.value)}
          aria-label="MBOX-Inhalt"
        />
        <Button
          className="mt-2"
          disabled={busy || !mboxContent.trim()}
          onClick={() => void importApi.mbox(mboxContent).then((r) => setStatus(`${r.imported} importiert`))}
        >
          MBOX importieren
        </Button>
      </section>

      <section aria-labelledby="import-contacts">
        <h2 id="import-contacts" className="mb-2 flex items-center gap-2 font-medium">
          <Users size={16} aria-hidden="true" /> Kontakte (.vcf)
        </h2>
        <Input type="file" accept=".vcf" aria-label="VCF-Datei auswählen" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f, 'vcf'); }} />
      </section>

      <section aria-labelledby="import-calendar">
        <h2 id="import-calendar" className="mb-2 flex items-center gap-2 font-medium">
          <Calendar size={16} aria-hidden="true" /> Kalender (.ics)
        </h2>
        <Input type="file" accept=".ics" aria-label="ICS-Datei auswählen" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f, 'ics'); }} />
      </section>

      {status && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
