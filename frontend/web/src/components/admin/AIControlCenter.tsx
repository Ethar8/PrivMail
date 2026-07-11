'use client';

import { useEffect, useState, useCallback } from 'react';
import { Cpu, MemoryStick, Bot, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiAdminApi, ServerAiConfig, SystemStatus } from '@/lib/ai-admin-api';
import { cn } from '@/lib/utils';

const MODELS: { value: ServerAiConfig['model']; label: string }[] = [
  { value: 'llama3', label: 'Llama 3' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'disabled', label: 'Deaktiviert' },
];

function Gauge({ label, percent, icon: Icon }: { label: string; percent: number; icon: typeof Cpu }) {
  const color = percent >= 85 ? 'bg-rose-500' : percent >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span className="flex items-center gap-2">
          <Icon size={16} /> {label}
        </span>
        <span className="tabular-nums font-medium text-slate-100">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function AIControlCenter() {
  const [config, setConfig] = useState<ServerAiConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await aiAdminApi.status());
    } catch {
      /* ignore transient status errors */
    }
  }, []);

  useEffect(() => {
    aiAdminApi
      .get()
      .then(setConfig)
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    void loadStatus();
    const t = setInterval(loadStatus, 4000); // live RAM/CPU
    return () => clearInterval(t);
  }, [loadStatus]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await aiAdminApi.set(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">KI-Schaltzentrale</h2>
            <p className="text-sm text-slate-400">Lokaler Ollama-Phishing-Filter & Ressourcen</p>
          </div>
        </div>

        {config && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Modell</label>
              <div className="flex gap-2">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setConfig({ ...config, model: m.value, enabled: m.value !== 'disabled' })}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                      config.model === m.value
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-300">
                <span>Spam-Sensitivität</span>
                <span className="tabular-nums text-indigo-300">{config.sensitivity}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={config.sensitivity}
                onChange={(e) => setConfig({ ...config, sensitivity: Number(e.target.value) })}
                className="w-full accent-indigo-500"
                disabled={config.model === 'disabled'}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>tolerant</span>
                <span>aggressiv</span>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

        <div className="mt-5">
          <Button onClick={save} disabled={saving || !config} className="gap-2">
            <Save size={16} /> {saved ? 'Gespeichert' : saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Gauge label="CPU-Last" percent={status?.cpu.loadPercent ?? 0} icon={Cpu} />
        <Gauge label="RAM-Auslastung" percent={status?.memory.usedMemPercent ?? 0} icon={MemoryStick} />
      </div>
    </div>
  );
}
