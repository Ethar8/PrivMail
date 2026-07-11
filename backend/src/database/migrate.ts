import * as fs from 'fs';
import * as path from 'path';
import { query } from './connection';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`);

  // Resolve the migrations directory whether we run from dist/ (compiled) or
  // src/ (ts-node). The .sql files live under database/migrations in both.
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(process.cwd(), 'dist', 'database', 'migrations'),
    path.join(process.cwd(), 'src', 'database', 'migrations'),
  ];
  const dir = candidates.find((c) => fs.existsSync(c));
  if (!dir) {
    logger.warn('No migrations directory found; skipping migrations');
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const { rows } = await query<{ name: string }>(`SELECT name FROM _migrations WHERE name = $1`, [file]);
    if (rows.length > 0) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    logger.info(`Applying migration ${file}`);
    await query(sql);
    await query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
  }
}
