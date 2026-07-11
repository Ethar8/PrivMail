'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { configureAI, loadAIConfig, AIProvider } from '@/lib/ai';

export function AIConfig() {
  const [provider, setProvider] = useState<AIProvider['provider']>('ollama');
  const [endpoint, setEndpoint] = useState('http://localhost:11434');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('llama3');
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const config = loadAIConfig();
    if (config) {
      setProvider(config.provider);
      setEndpoint(config.endpoint);
      setApiKey(config.apiKey ?? '');
      setModel(config.model);
      setEnabled(config.enabled);
    }
  }, []);

  const handleSave = () => {
    configureAI({ provider, endpoint, apiKey: apiKey || undefined, model, enabled });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">KI-Funktionen</h3>
          <p className="text-sm text-muted-foreground">Aktiviere KI-gestützte Zusammenfassungen und Antwortvorschläge.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Anbieter</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider['provider'])}
          className="h-10 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="ollama">Ollama (lokal)</option>
          <option value="openai">OpenAI</option>
          <option value="custom">Eigener Endpoint</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Endpoint</label>
        <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
      </div>
      {provider !== 'ollama' && (
        <div>
          <label className="mb-1 block text-sm font-medium">API-Schlüssel</label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Modell</label>
        <Input value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div>
        <Button onClick={handleSave}>{saved ? 'Gespeichert!' : 'Speichern'}</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Die KI-Anfragen laufen direkt von deinem Browser zum Anbieter. PrivMail-Server sehen deine
        E-Mail-Inhalte dabei nicht.
      </p>
    </div>
  );
}
