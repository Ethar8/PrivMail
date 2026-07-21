import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { importMbox, importEml, parseVcf, parseIcs } from '../../services/import-mail';
import { importFromImap } from '../../services/imap-import';
import {
  createImportJob,
  getImportJob,
  listImportJobs,
  estimateRemainingSeconds,
} from '../../services/import-jobs';
import { query } from '../../database/connection';
import { randomUUID } from 'crypto';

export const importRouter = Router();

importRouter.use(requireAuth);

const mboxSchema = z.object({
  content: z.string().min(1),
  mailbox: z.string().optional(),
});

importRouter.post('/mbox', async (req: AuthedRequest, res) => {
  const parsed = mboxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const result = await importMbox(req.userId!, parsed.data.content, parsed.data.mailbox);
  res.json(result);
});

const emlSchema = z.object({
  content: z.string().min(1),
  mailbox: z.string().optional(),
});

importRouter.post('/eml', async (req: AuthedRequest, res) => {
  const parsed = emlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const result = await importEml(req.userId!, parsed.data.content, parsed.data.mailbox);
  res.json(result);
});

const imapSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(993),
  user: z.string().min(1),
  password: z.string().min(1),
  mailbox: z.string().optional(),
  useTls: z.boolean().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

/** Legacy sync single-mailbox import */
importRouter.post('/imap', async (req: AuthedRequest, res) => {
  const parsed = imapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await importFromImap(req.userId!, parsed.data);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const easySwitchSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(993),
  user: z.string().min(1),
  password: z.string().min(1),
  useTls: z.boolean().optional(),
  limitPerMailbox: z.number().int().min(1).max(10000).optional(),
});

/** Easy-Switch: background job importing all folders */
importRouter.post('/easy-switch', async (req: AuthedRequest, res) => {
  const parsed = easySwitchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const job = await createImportJob(req.userId!, 'imap-easy-switch', parsed.data);
  res.status(202).json({
    jobId: job.id,
    status: job.status,
    message: 'Import läuft im Hintergrund',
  });
});

importRouter.get('/jobs', async (req: AuthedRequest, res) => {
  const jobs = await listImportJobs(req.userId!);
  res.json({
    jobs: jobs.map((j) => ({
      ...j,
      estimatedRemainingSeconds: estimateRemainingSeconds(j),
    })),
  });
});

importRouter.get('/jobs/:id', async (req: AuthedRequest, res) => {
  const job = await getImportJob(req.userId!, req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job nicht gefunden' });
    return;
  }
  res.json({
    job: {
      ...job,
      estimatedRemainingSeconds: estimateRemainingSeconds(job),
    },
  });
});

const vcfSchema = z.object({ content: z.string().min(1) });

importRouter.post('/vcf', async (req: AuthedRequest, res) => {
  const parsed = vcfSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const contacts = parseVcf(parsed.data.content);
  let imported = 0;
  for (const c of contacts) {
    await query(
      `INSERT INTO contacts (id, user_id, name, email, phone, organization, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), req.userId!, c.name, c.email, c.phone, c.organization, c.notes],
    );
    imported++;
  }
  res.json({ imported, skipped: 0, errors: [] });
});

const icsSchema = z.object({ content: z.string().min(1) });

importRouter.post('/ics', async (req: AuthedRequest, res) => {
  const parsed = icsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const events = parseIcs(parsed.data.content);
  let imported = 0;
  for (const e of events) {
    await query(
      `INSERT INTO calendar_events (id, user_id, title_enc, start_at, end_at, location_enc, notes_enc, location_plain)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        req.userId!,
        e.title,
        e.startAt.toISOString(),
        e.endAt.toISOString(),
        e.location || null,
        e.description || null,
        e.location || null,
      ],
    );
    imported++;
  }
  res.json({ imported, skipped: 0, errors: [] });
});
