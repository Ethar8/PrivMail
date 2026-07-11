import { promises as dns } from 'dns';
import { logger } from '../utils/logger';

/**
 * Thin wrapper around Node's DNS resolver with error tolerance. Used by the
 * SPF/DKIM/DMARC modules so lookups can be mocked easily in tests.
 */
export const resolver = {
  async txt(name: string): Promise<string[]> {
    try {
      const records = await dns.resolveTxt(name);
      return records.map((parts) => parts.join(''));
    } catch (err) {
      logger.debug(`TXT lookup failed for ${name}`, (err as Error).message);
      return [];
    }
  },

  async mx(domain: string): Promise<{ exchange: string; priority: number }[]> {
    try {
      const records = await dns.resolveMx(domain);
      return records.sort((a, b) => a.priority - b.priority);
    } catch (err) {
      logger.debug(`MX lookup failed for ${domain}`, (err as Error).message);
      return [];
    }
  },

  async a(domain: string): Promise<string[]> {
    try {
      return await dns.resolve4(domain);
    } catch {
      return [];
    }
  },

  async aaaa(domain: string): Promise<string[]> {
    try {
      return await dns.resolve6(domain);
    } catch {
      return [];
    }
  },

  async ptr(ip: string): Promise<string[]> {
    try {
      return await dns.reverse(ip);
    } catch (err) {
      logger.debug(`PTR lookup failed for ${ip}`, (err as Error).message);
      return [];
    }
  },
};

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at === -1 ? address.trim() : address.slice(at + 1).trim();
}
