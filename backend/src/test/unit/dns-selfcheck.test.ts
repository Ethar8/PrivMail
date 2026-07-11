import { runDnsSelfCheck } from '../../dns/self-check';
import { resolver } from '../../dns/resolver';

describe('DNS self-check', () => {
  it('reports all missing when no records exist', async () => {
    jest.spyOn(resolver, 'mx').mockResolvedValue([]);
    jest.spyOn(resolver, 'txt').mockResolvedValue([]);
    jest.spyOn(resolver, 'ptr').mockResolvedValue([]);

    const report = await runDnsSelfCheck();
    expect(report.items).toHaveLength(5);
    const byCheck = Object.fromEntries(report.items.map((i) => [i.check, i]));
    expect(byCheck.MX.status).toBe('missing');
    expect(byCheck.SPF.status).toBe('missing');
    expect(byCheck.DMARC.status).toBe('missing');
    expect(byCheck.MX.suggestion).toBeDefined();
    expect(report.score).toBe(0);
  });

  it('reports ok for a fully configured domain', async () => {
    jest.spyOn(resolver, 'mx').mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    jest.spyOn(resolver, 'txt').mockImplementation(async (name: string) => {
      if (name.startsWith('_dmarc.')) return ['v=DMARC1; p=quarantine; rua=mailto:d@example.com'];
      if (name.includes('_domainkey.')) return ['v=DKIM1; k=rsa; p=MIIBIjANBgkq'];
      return ['v=spf1 mx a -all'];
    });
    jest.spyOn(resolver, 'ptr').mockResolvedValue(['mail.example.com']);

    const report = await runDnsSelfCheck();
    const byCheck = Object.fromEntries(report.items.map((i) => [i.check, i]));
    expect(byCheck.SPF.status).toBe('ok');
    expect(byCheck.DKIM.status).toBe('ok');
    expect(byCheck.DMARC.status).toBe('ok');
    expect(byCheck.MX.status).toBe('ok');
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it('flags a weak DMARC policy (p=none) as warning', async () => {
    jest.spyOn(resolver, 'mx').mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    jest.spyOn(resolver, 'txt').mockImplementation(async (name: string) => {
      if (name.startsWith('_dmarc.')) return ['v=DMARC1; p=none'];
      return [];
    });
    jest.spyOn(resolver, 'ptr').mockResolvedValue([]);

    const report = await runDnsSelfCheck();
    const dmarc = report.items.find((i) => i.check === 'DMARC')!;
    expect(dmarc.status).toBe('warning');
    expect(dmarc.suggestion).toBeDefined();
  });
});
