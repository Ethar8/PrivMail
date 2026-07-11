import { resolver } from './resolver';
import { config } from '../config/config';

export type CheckStatus = 'ok' | 'warning' | 'missing' | 'error';

export interface DnsCheckItem {
  check: 'MX' | 'SPF' | 'DKIM' | 'DMARC' | 'PTR';
  status: CheckStatus;
  found: string | null;
  detail: string;
  /** Suggested DNS record to publish when the check is not OK. */
  suggestion?: {
    type: string; // e.g. 'TXT', 'MX', 'PTR'
    host: string; // record name
    value: string; // record value to copy
  };
}

export interface DnsCheckReport {
  domain: string;
  checkedAt: string;
  items: DnsCheckItem[];
  score: number; // 0-100 based on passed checks
}

async function checkMx(domain: string): Promise<DnsCheckItem> {
  const mx = await resolver.mx(domain);
  if (mx.length === 0) {
    return {
      check: 'MX',
      status: 'missing',
      found: null,
      detail: 'Kein MX-Eintrag gefunden. E-Mails können nicht zugestellt werden.',
      suggestion: { type: 'MX', host: domain, value: `10 mail.${domain}` },
    };
  }
  const list = mx.map((m) => `${m.priority} ${m.exchange}`).join(', ');
  return { check: 'MX', status: 'ok', found: list, detail: `${mx.length} MX-Eintrag/-Einträge gefunden.` };
}

async function checkSpf(domain: string): Promise<DnsCheckItem> {
  const txts = await resolver.txt(domain);
  const record = txts.find((r) => r.toLowerCase().startsWith('v=spf1')) ?? null;
  if (!record) {
    return {
      check: 'SPF',
      status: 'missing',
      found: null,
      detail: 'Kein SPF-Record vorhanden. Ausgehende Mails werden eher als Spam markiert.',
      suggestion: { type: 'TXT', host: domain, value: `v=spf1 mx a -all` },
    };
  }
  const hardFail = /[-~]all\s*$/.test(record.trim());
  return {
    check: 'SPF',
    status: hardFail ? 'ok' : 'warning',
    found: record,
    detail: hardFail
      ? 'Gültiger SPF-Record mit strikter Policy.'
      : 'SPF-Record vorhanden, aber ohne strikte "-all"/"~all"-Policy.',
    suggestion: hardFail ? undefined : { type: 'TXT', host: domain, value: `${record.trim()} -all` },
  };
}

async function checkDkim(domain: string, selector: string): Promise<DnsCheckItem> {
  const host = `${selector}._domainkey.${domain}`;
  const txts = await resolver.txt(host);
  const record = txts.find((r) => /v=DKIM1/i.test(r) || /p=/.test(r)) ?? null;
  if (!record) {
    return {
      check: 'DKIM',
      status: 'missing',
      found: null,
      detail: `Kein DKIM-Record für Selector "${selector}" gefunden.`,
      suggestion: { type: 'TXT', host, value: 'v=DKIM1; k=rsa; p=<PUBLIC_KEY>' },
    };
  }
  const hasKey = /p=[A-Za-z0-9+/]+/.test(record);
  return {
    check: 'DKIM',
    status: hasKey ? 'ok' : 'warning',
    found: record,
    detail: hasKey ? 'Gültiger DKIM-Record mit öffentlichem Schlüssel.' : 'DKIM-Record ohne Schlüssel (p=).',
  };
}

async function checkDmarc(domain: string): Promise<DnsCheckItem> {
  const host = `_dmarc.${domain}`;
  const txts = await resolver.txt(host);
  const record = txts.find((r) => r.toLowerCase().startsWith('v=dmarc1')) ?? null;
  if (!record) {
    return {
      check: 'DMARC',
      status: 'missing',
      found: null,
      detail: 'Kein DMARC-Record vorhanden. Empfehlung: mindestens p=quarantine.',
      suggestion: { type: 'TXT', host, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
    };
  }
  const policy = record.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase();
  const weak = policy === 'none' || !policy;
  return {
    check: 'DMARC',
    status: weak ? 'warning' : 'ok',
    found: record,
    detail: weak
      ? `DMARC vorhanden, aber Policy "${policy ?? 'none'}" bietet keinen aktiven Schutz.`
      : `DMARC aktiv mit Policy "${policy}".`,
    suggestion: weak
      ? { type: 'TXT', host, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` }
      : undefined,
  };
}

async function checkPtr(domain: string, ip: string): Promise<DnsCheckItem> {
  if (!ip) {
    return {
      check: 'PTR',
      status: 'warning',
      found: null,
      detail: 'Keine öffentliche IP konfiguriert (PUBLIC_IP). Reverse-DNS kann nicht geprüft werden.',
    };
  }
  const names = await resolver.ptr(ip);
  if (names.length === 0) {
    return {
      check: 'PTR',
      status: 'missing',
      found: null,
      detail: `Kein PTR-Eintrag für ${ip}. Viele Server lehnen Mails ohne Reverse-DNS ab.`,
      suggestion: { type: 'PTR', host: ip, value: `mail.${domain}` },
    };
  }
  const matches = names.some((n) => n.toLowerCase().includes(domain.toLowerCase()));
  return {
    check: 'PTR',
    status: matches ? 'ok' : 'warning',
    found: names.join(', '),
    detail: matches
      ? 'Reverse-DNS zeigt auf die eigene Domain.'
      : 'PTR-Eintrag vorhanden, passt aber nicht zur Domain.',
  };
}

/**
 * Runs all self checks for the configured domain and returns a structured
 * report used by the admin DNS dashboard.
 */
export async function runDnsSelfCheck(): Promise<DnsCheckReport> {
  const domain = config.domain;
  const items = await Promise.all([
    checkMx(domain),
    checkSpf(domain),
    checkDkim(domain, config.dkimSelector),
    checkDmarc(domain),
    checkPtr(domain, config.publicIp),
  ]);

  const passed = items.filter((i) => i.status === 'ok').length;
  const score = Math.round((passed / items.length) * 100);

  return { domain, checkedAt: new Date().toISOString(), items, score };
}
