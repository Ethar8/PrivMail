import { resolver, domainOf } from './resolver';

export interface SPFResult {
  pass: boolean;
  result: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  record: string | null;
  reason: string;
}

/**
 * SPF evaluation (RFC 7208, common subset). Fetches the domain's SPF record and
 * checks the sending IP against ip4/ip6/a/mx/include mechanisms with qualifier
 * handling (+, -, ~, ?). Does not expand macros.
 */
export async function checkSPF(from: string, senderIP: string, depth = 0): Promise<SPFResult> {
  const domain = domainOf(from);
  if (depth > 5) {
    return { pass: false, result: 'neutral', record: null, reason: 'max include depth' };
  }

  const txts = await resolver.txt(domain);
  const record = txts.find((r) => r.toLowerCase().startsWith('v=spf1')) ?? null;
  if (!record) {
    return { pass: false, result: 'none', record: null, reason: 'no SPF record' };
  }

  const mechanisms = record.split(/\s+/).slice(1);
  for (const mech of mechanisms) {
    const qualifier = ['+', '-', '~', '?'].includes(mech[0]) ? mech[0] : '+';
    const term = qualifier === mech[0] ? mech.slice(1) : mech;

    if (await matchMechanism(term, domain, senderIP, depth)) {
      return {
        pass: qualifier === '+',
        result: qualifierToResult(qualifier),
        record,
        reason: `matched ${mech}`,
      };
    }
  }

  return { pass: false, result: 'neutral', record, reason: 'no matching mechanism' };
}

function qualifierToResult(q: string): SPFResult['result'] {
  switch (q) {
    case '+':
      return 'pass';
    case '-':
      return 'fail';
    case '~':
      return 'softfail';
    default:
      return 'neutral';
  }
}

async function matchMechanism(
  term: string,
  domain: string,
  senderIP: string,
  depth: number,
): Promise<boolean> {
  if (term === 'all') return true;

  if (term.startsWith('ip4:') || term.startsWith('ip6:')) {
    const cidr = term.slice(4);
    return ipMatchesCidr(senderIP, cidr);
  }

  if (term === 'a' || term.startsWith('a:')) {
    const target = term.includes(':') ? term.slice(2) : domain;
    const ips = [...(await resolver.a(target)), ...(await resolver.aaaa(target))];
    return ips.includes(senderIP);
  }

  if (term === 'mx' || term.startsWith('mx:')) {
    const target = term.includes(':') ? term.slice(3) : domain;
    const mxs = await resolver.mx(target);
    for (const mx of mxs) {
      const ips = [...(await resolver.a(mx.exchange)), ...(await resolver.aaaa(mx.exchange))];
      if (ips.includes(senderIP)) return true;
    }
    return false;
  }

  if (term.startsWith('include:')) {
    const included = term.slice(8);
    const result = await checkSPF(`x@${included}`, senderIP, depth + 1);
    return result.pass;
  }

  return false;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;
  const [range, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  // IPv4 only for the numeric comparison; IPv6 falls back to exact prefix match.
  if (ip.includes(':') || range.includes(':')) return ip.startsWith(range.split('::')[0]);
  const ipNum = ipv4ToInt(ip);
  const rangeNum = ipv4ToInt(range);
  if (ipNum === null || rangeNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
