import { checkSPF } from '../../dns/spf';
import { checkDMARC } from '../../dns/dmarc';
import { resolver } from '../../dns/resolver';

describe('SPF', () => {
  it('returns "none" when no SPF record exists', async () => {
    jest.spyOn(resolver, 'txt').mockResolvedValueOnce([]);
    const result = await checkSPF('user@nospf.example', '1.2.3.4');
    expect(result.result).toBe('none');
    expect(result.pass).toBe(false);
  });

  it('passes on ip4 match', async () => {
    jest.spyOn(resolver, 'txt').mockResolvedValueOnce(['v=spf1 ip4:1.2.3.4 -all']);
    const result = await checkSPF('user@example.com', '1.2.3.4');
    expect(result.pass).toBe(true);
  });
});

describe('DMARC', () => {
  it('accepts when no DMARC record exists', async () => {
    jest.spyOn(resolver, 'txt').mockResolvedValueOnce([]);
    const result = await checkDMARC('user@nodmarc.example', { pass: false }, { pass: false });
    expect(result.action).toBe('accept');
  });

  it('rejects on p=reject with failed auth', async () => {
    jest.spyOn(resolver, 'txt').mockResolvedValueOnce(['v=DMARC1; p=reject']);
    const result = await checkDMARC('user@example.com', { pass: false }, { pass: false });
    expect(result.action).toBe('reject');
  });
});
