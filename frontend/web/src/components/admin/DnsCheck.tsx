'use client';

import { useState } from 'react';
import { adminApi, DnsCheckItem, DnsCheckReport, DnsCheckStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_META: Record<
  DnsCheckStatus,
  { label: string; dot: string; ring: string; text: string; Icon: typeof CheckCircle2 }
> = {
  ok: {
    label: 'Bestanden',
    dot: 'bg-emerald-500',
    ring: 'shadow-[0_0_0_4px_rgba(16,185,129,0.15)]',
    text: 'text-emerald-400',
    Icon: CheckCircle2,
  },
  warning: {
    label: 'Warnung',
    dot: 'bg-amber-500',
    ring: 'shadow-[0_0_0_4px_rgba(245,158,11,0.15)]',
    text: 'text-amber-400',
    Icon: AlertTriangle,
  },
  missing: {
    label: 'Fehlt',
    dot: 'bg-rose-500',
    ring: 'shadow-[0_0_0_4px_rgba(244,63,94,0.15)]',
    text: 'text-rose-400',
    Icon: XCircle,
  },
  error: {
    label: 'Fehler',
    dot: 'bg-rose-500',
    ring: 'shadow-[0_0_0_4px_rgba(244,63,94,0.15)]',
    text: 'text-rose-400',
    Icon: XCircle,
  },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

function CheckRow({ item }: { item: DnsCheckItem }) {
  const meta = STATUS_META[item.status];
  const { Icon } = meta;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            {item.status === 'ok' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            )}
            {(item.status === 'missing' || item.status === 'error') && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            )}
            <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', meta.dot, meta.ring)} />
          </span>
          <span className="font-semibold tracking-tight text-slate-100">{item.check}</span>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm font-medium', meta.text)}>
          <Icon size={16} />
          {meta.label}
        </div>
      </div>

      <p className="mt-2 pl-6 text-sm text-slate-400">{item.detail}</p>

      {item.found && (
        <pre className="mt-2 ml-6 overflow-x-auto rounded-lg border border-white/5 bg-black/40 px-3 py-2 text-xs text-slate-300">
          {item.found}
        </pre>
      )}

      {item.suggestion && (
        <div className="mt-3 ml-6 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
              Empfohlener Eintrag
            </span>
            <CopyButton value={item.suggestion.value} />
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">Typ</dt>
            <dd className="font-mono text-slate-200">{item.suggestion.type}</dd>
            <dt className="text-slate-500">Host</dt>
            <dd className="break-all font-mono text-slate-200">{item.suggestion.host}</dd>
            <dt className="text-slate-500">Wert</dt>
            <dd className="break-all font-mono text-slate-200">{item.suggestion.value}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

export function DnsCheck() {
  const [report, setReport] = useState<DnsCheckReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await adminApi.dnsCheck());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor =
    !report ? 'text-slate-400'
    : report.score >= 80 ? 'text-emerald-400'
    : report.score >= 50 ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">DNS- & Sicherheits-Zentrum</h2>
            <p className="text-sm text-slate-400">
              {report ? `Domain: ${report.domain}` : 'Live-Prüfung der E-Mail-DNS-Konfiguration'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {report && (
            <div className="text-right">
              <div className={cn('text-2xl font-bold tabular-nums', scoreColor)}>{report.score}%</div>
              <div className="text-xs text-slate-500">Score</div>
            </div>
          )}
          <Button onClick={run} disabled={loading} className="gap-2">
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
            {loading ? 'Prüfe…' : 'DNS jetzt prüfen'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 px-6 py-12 text-center">
          <ShieldCheck size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            Starte eine Prüfung, um SPF, DKIM, DMARC, MX und Reverse-DNS live zu validieren.
          </p>
        </div>
      )}

      {report && (
        <div className="grid gap-3">
          {report.items.map((item) => (
            <CheckRow key={item.check} item={item} />
          ))}
          <p className="pt-1 text-right text-xs text-slate-500">
            Zuletzt geprüft: {new Date(report.checkedAt).toLocaleString('de-DE')}
          </p>
        </div>
      )}
    </div>
  );
}
