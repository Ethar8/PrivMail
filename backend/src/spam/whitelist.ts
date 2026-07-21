import { query } from '../database/connection';
import { logger } from '../utils/logger';

export class ListStore {
  private items = new Set<string>();
  private kind: 'whitelist' | 'blacklist';

  constructor(kind: 'whitelist' | 'blacklist', initial: string[] = []) {
    this.kind = kind;
    initial.forEach((i) => this.items.add(i.toLowerCase()));
    this.loadFromDb();
  }

  private async loadFromDb(): Promise<void> {
    try {
      const { rows } = await query<{ entry: string }>(
        `SELECT entry FROM spam_list_entries WHERE kind = $1`,
        [this.kind],
      );
      for (const row of rows) {
        this.items.add(row.entry.toLowerCase());
      }
      logger.debug(`Loaded ${rows.length} ${this.kind} entries from database`);
    } catch {
      logger.warn(`Could not load ${this.kind} entries from database, using in-memory only`);
    }
  }

  async add(entry: string): Promise<void> {
    const lower = entry.toLowerCase();
    this.items.add(lower);
    try {
      await query(
        `INSERT INTO spam_list_entries (kind, entry) VALUES ($1, $2) ON CONFLICT (kind, entry) DO NOTHING`,
        [this.kind, lower],
      );
    } catch {
      // Non-fatal: in-memory entry already exists
    }
  }

  async remove(entry: string): Promise<void> {
    const lower = entry.toLowerCase();
    this.items.delete(lower);
    try {
      await query(`DELETE FROM spam_list_entries WHERE kind = $1 AND entry = $2`, [this.kind, lower]);
    } catch {
      // Non-fatal
    }
  }

  has(entry: string): boolean {
    return this.items.has(entry.toLowerCase());
  }

  list(): string[] {
    return [...this.items];
  }
}

export const whitelist = new ListStore('whitelist');
export const blacklist = new ListStore('blacklist', [
  'spammer@example.com',
]);
