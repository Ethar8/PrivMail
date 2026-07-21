import { Router } from 'express';
import { z } from 'zod';
import * as os from 'os';
import { emailSchema } from '../../utils/validator';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { listUsers, createUser, deleteUser } from '../../models/user';
import { query } from '../../database/connection';
import { outboundQueue } from '../../mail/queue';
import { runDnsSelfCheck } from '../../dns/self-check';
import { getAiConfig, saveAiConfig } from '../../spam/ai-config-store';
import { whitelist, blacklist } from '../../spam/whitelist';
import { checkSuiteHealth } from '../../services/suite-health';
import { config } from '../../config/config';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', async (_req, res) => {
  res.json({ users: await listUsers() });
});

const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  displayName: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

adminRouter.post('/users', async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const user = await createUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.displayName,
      parsed.data.isAdmin ?? false,
    );
    res.status(201).json({ user });
  } catch {
    res.status(409).json({ error: 'User already exists' });
  }
});

adminRouter.delete('/users/:id', async (req, res) => {
  await deleteUser(req.params.id);
  res.json({ ok: true });
});

adminRouter.get('/domains', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM domains ORDER BY created_at DESC`);
  res.json({ domains: rows });
});

adminRouter.post('/domains', async (req, res) => {
  const name = String(req.body?.name ?? '').trim().toLowerCase();
  if (!name) {
    res.status(400).json({ error: 'Domain name required' });
    return;
  }
  const { rows } = await query(
    `INSERT INTO domains (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`,
    [name],
  );
  res.status(201).json({ domain: rows[0] ?? null });
});

adminRouter.get('/dns-check', async (_req, res) => {
  const report = await runDnsSelfCheck();
  res.json(report);
});

adminRouter.get('/status', async (_req, res) => {
  const { rows: userRows } = await query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM users`);
  const { rows: mailRows } = await query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM emails`);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const load = os.loadavg();
  const cpuCount = os.cpus().length;
  let suite;
  try {
    suite = await checkSuiteHealth();
  } catch {
    suite = {
      oidc: {
        issuer: config.oidc.issuer,
        discoveryReachable: false,
        discoveryUrl: `${config.oidc.issuer}/.well-known/openid-configuration`,
        lastSuccessfulLogin: null,
      },
      vaultwarden: {
        name: 'Vaultwarden',
        reachable: false,
        url: config.oidc.vaultUrl,
        detail: 'health check failed',
      },
      immich: {
        name: 'Immich',
        reachable: false,
        url: config.oidc.photosUrl,
        detail: 'health check failed',
      },
    };
  }
  res.json({
    users: Number(userRows[0]?.count ?? 0),
    emails: Number(mailRows[0]?.count ?? 0),
    queueSize: outboundQueue.size,
    uptime: process.uptime(),
    memory: {
      rss: process.memoryUsage().rss,
      totalMem,
      freeMem,
      usedMemPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    },
    cpu: {
      count: cpuCount,
      load1: load[0],
      load5: load[1],
      load15: load[2],
      loadPercent: Math.min(100, Math.round((load[0] / cpuCount) * 100)),
    },
    suite,
  });
});

// --- AI configuration (LLM spam classifier) ---
adminRouter.get('/ai-config', async (_req, res) => {
  res.json(await getAiConfig());
});

const aiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.enum(['llama3', 'mistral', 'disabled']).optional(),
  endpoint: z.string().url().optional(),
  sensitivity: z.number().int().min(0).max(100).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

adminRouter.post('/ai-config', async (req, res) => {
  const parsed = aiConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const patch = { ...parsed.data };
  if (patch.model === 'disabled') patch.enabled = false;
  const saved = await saveAiConfig(patch);
  res.json(saved);
});

adminRouter.get('/whitelist', async (_req, res) => {
  res.json({ whitelist: whitelist.list(), blacklist: blacklist.list() });
});

adminRouter.post('/whitelist', async (req, res) => {
  const schema = z.object({ kind: z.enum(['whitelist', 'blacklist']), entry: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const store = parsed.data.kind === 'whitelist' ? whitelist : blacklist;
  await store.add(parsed.data.entry);
  res.status(201).json({ ok: true, list: store.list() });
});

adminRouter.delete('/whitelist', async (req, res) => {
  const schema = z.object({ kind: z.enum(['whitelist', 'blacklist']), entry: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const store = parsed.data.kind === 'whitelist' ? whitelist : blacklist;
  await store.remove(parsed.data.entry);
  res.json({ ok: true, list: store.list() });
});
