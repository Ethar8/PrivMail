import { query } from '../database/connection';
import { importFromImapEasySwitch, EasySwitchProgress } from './imap-import';
import { logger } from '../utils/logger';

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ImportJob {
  id: string;
  user_id: string;
  kind: string;
  status: ImportJobStatus;
  progress_imported: number;
  progress_total: number;
  progress_skipped: number;
  current_mailbox: string | null;
  error_message: string | null;
  config_json: string;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

const running = new Set<string>();

export async function createImportJob(
  userId: string,
  kind: string,
  config: Record<string, unknown>,
): Promise<ImportJob> {
  const { rows } = await query<ImportJob>(
    `INSERT INTO import_jobs (user_id, kind, status, config_json)
     VALUES ($1, $2, 'pending', $3) RETURNING *`,
    [userId, kind, JSON.stringify(config)],
  );
  const job = rows[0];
  void processImportJob(job.id);
  return job;
}

export async function getImportJob(userId: string, jobId: string): Promise<ImportJob | null> {
  const { rows } = await query<ImportJob>(
    `SELECT * FROM import_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId],
  );
  return rows[0] ?? null;
}

export async function listImportJobs(userId: string): Promise<ImportJob[]> {
  const { rows } = await query<ImportJob>(
    `SELECT * FROM import_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
  return rows;
}

async function updateProgress(jobId: string, p: EasySwitchProgress): Promise<void> {
  await query(
    `UPDATE import_jobs SET
       status = 'running',
       progress_imported = $2,
       progress_total = $3,
       progress_skipped = $4,
       current_mailbox = $5,
       started_at = COALESCE(started_at, NOW())
     WHERE id = $1`,
    [jobId, p.imported, p.total, p.skipped, p.currentMailbox],
  );
}

export async function processImportJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    const { rows } = await query<ImportJob>(`SELECT * FROM import_jobs WHERE id = $1`, [jobId]);
    const job = rows[0];
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    await query(`UPDATE import_jobs SET status = 'running', started_at = NOW() WHERE id = $1`, [jobId]);
    const cfg = JSON.parse(job.config_json) as {
      host: string;
      port: number;
      user: string;
      password: string;
      useTls?: boolean;
      limitPerMailbox?: number;
    };

    const result = await importFromImapEasySwitch(job.user_id, cfg, (p) => {
      void updateProgress(jobId, p);
    });

    await query(
      `UPDATE import_jobs SET
         status = 'completed',
         progress_imported = $2,
         progress_total = $3,
         progress_skipped = $4,
         current_mailbox = NULL,
         finished_at = NOW()
       WHERE id = $1`,
      [jobId, result.imported, result.imported + result.skipped, result.skipped],
    );
  } catch (err) {
    logger.warn(`Import job ${jobId} failed: ${(err as Error).message}`);
    await query(
      `UPDATE import_jobs SET status = 'failed', error_message = $2, finished_at = NOW() WHERE id = $1`,
      [jobId, (err as Error).message],
    );
  } finally {
    running.delete(jobId);
  }
}

/** Estimate remaining seconds from current progress (rough). */
export function estimateRemainingSeconds(job: ImportJob): number | null {
  if (job.status !== 'running' || !job.started_at || job.progress_imported <= 0) return null;
  const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
  const rate = job.progress_imported / Math.max(elapsed, 1);
  const remaining = Math.max(0, job.progress_total - job.progress_imported);
  if (rate <= 0) return null;
  return Math.round(remaining / rate);
}
