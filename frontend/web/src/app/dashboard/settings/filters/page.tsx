'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { filtersApi } from '@/lib/api';

type Rule = {
  id: string;
  name: string;
  condition_field: string;
  condition_op: string;
  condition_value: string;
  action: string;
  action_value: string | null;
  is_active: boolean;
};

export default function FiltersSettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState('');
  const [conditionField, setConditionField] = useState('from');
  const [conditionOp, setConditionOp] = useState('contains');
  const [conditionValue, setConditionValue] = useState('');
  const [action, setAction] = useState('move');
  const [actionValue, setActionValue] = useState('Archive');
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const data = await filtersApi.list();
    setRules(data.rules);
  };

  useEffect(() => {
    void reload().catch((err) => setError((err as Error).message));
  }, []);

  const handleCreate = async () => {
    setError(null);
    try {
      await filtersApi.create({
        name,
        conditionField,
        conditionOp,
        conditionValue,
        action,
        actionValue: action === 'delete' ? undefined : actionValue,
      });
      setName('');
      setConditionValue('');
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Filter &amp; Regeln</h1>
        <p className="text-sm text-muted-foreground">
          Serverseitige Regeln: Absender/Betreff/Schlüsselwort → verschieben, löschen, labeln oder
          weiterleiten.
        </p>
      </div>
      <form
        className="grid gap-3 rounded border border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <Input aria-label="Regelname" placeholder="Regelname" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-2">
          <label className="sr-only" htmlFor="cond-field">
            Feld
          </label>
          <select
            id="cond-field"
            className="h-10 rounded border border-border bg-background px-2 text-sm"
            value={conditionField}
            onChange={(e) => setConditionField(e.target.value)}
          >
            <option value="from">Absender</option>
            <option value="to">Empfänger</option>
            <option value="subject">Betreff</option>
            <option value="body">Inhalt</option>
          </select>
          <select
            aria-label="Operator"
            className="h-10 rounded border border-border bg-background px-2 text-sm"
            value={conditionOp}
            onChange={(e) => setConditionOp(e.target.value)}
          >
            <option value="contains">enthält</option>
            <option value="equals">gleich</option>
            <option value="starts_with">beginnt mit</option>
            <option value="matches">Regex</option>
          </select>
          <Input
            aria-label="Bedingungswert"
            placeholder="Wert"
            value={conditionValue}
            onChange={(e) => setConditionValue(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Aktion"
            className="h-10 rounded border border-border bg-background px-2 text-sm"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="move">Verschieben</option>
            <option value="delete">Löschen</option>
            <option value="label">Label</option>
            <option value="forward">Weiterleiten</option>
          </select>
          {action !== 'delete' && (
            <Input
              aria-label="Aktionsziel"
              placeholder={action === 'forward' ? 'ziel@example.com' : 'Mailbox/Label'}
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
            />
          )}
        </div>
        <Button type="submit">
          <Plus size={16} aria-hidden="true" /> Regel speichern
        </Button>
      </form>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border rounded border border-border" aria-label="Regel-Liste">
        {rules.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-3 text-sm">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-muted-foreground">
                Wenn {r.condition_field} {r.condition_op} „{r.condition_value}“ → {r.action}
                {r.action_value ? ` (${r.action_value})` : ''}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Regel ${r.name} löschen`}
              onClick={() =>
                void filtersApi
                  .remove(r.id)
                  .then(reload)
                  .catch((err) => setError((err as Error).message))
              }
            >
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">Noch keine Regeln.</li>
        )}
      </ul>
    </div>
  );
}
