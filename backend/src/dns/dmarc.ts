import { resolver, domainOf } from './resolver';

export interface DMARCResult {
  pass: boolean;
  policy: 'none' | 'quarantine' | 'reject';
  record: string | null;
  reason: string;
  action: 'accept' | 'quarantine' | 'reject';
}

/**
 * DMARC evaluation (RFC 7489): fetches the _dmarc record, checks SPF/DKIM
 * alignment (relaxed – organizational domain equality) and derives the action
 * from the published policy.
 */
export async function checkDMARC(
  from: string,
  spf: { pass: boolean; domain?: string },
  dkim: { pass: boolean; domain?: string | null },
): Promise<DMARCResult> {
  const fromDomain = domainOf(from);
  const txts = await resolver.txt(`_dmarc.${fromDomain}`);
  const record = txts.find((r) => r.toLowerCase().startsWith('v=dmarc1')) ?? null;

  if (!record) {
    return { pass: true, policy: 'none', record: null, reason: 'no DMARC record', action: 'accept' };
  }

  const policyMatch = record.match(/p\s*=\s*(none|quarantine|reject)/i);
  const policy = (policyMatch?.[1].toLowerCase() ?? 'none') as DMARCResult['policy'];

  const spfAligned = spf.pass && (!spf.domain || aligns(spf.domain, fromDomain));
  const dkimAligned = dkim.pass && (!dkim.domain || aligns(dkim.domain, fromDomain));
  const pass = spfAligned || dkimAligned;

  let action: DMARCResult['action'] = 'accept';
  if (!pass) {
    if (policy === 'reject') action = 'reject';
    else if (policy === 'quarantine') action = 'quarantine';
  }

  return {
    pass,
    policy,
    record,
    reason: pass ? 'aligned (SPF or DKIM)' : 'no aligned authentication',
    action,
  };
}

function aligns(authDomain: string, fromDomain: string): boolean {
  const a = authDomain.toLowerCase();
  const f = fromDomain.toLowerCase();
  return a === f || a.endsWith(`.${f}`) || f.endsWith(`.${a}`);
}
