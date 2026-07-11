// ============================================================================
// PATCH for backend/src/api/routes/admin.ts
// Adds GET/POST /api/admin/ai-config and extends /status with live CPU/RAM.
// (Shown as a standalone snippet; integrated into admin.ts on promotion.)
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import * as os from 'os';
import { getAiConfig, saveAiConfig } from '../../spam/ai-config-store';

export const aiConfigRoutes = Router();

// GET current AI configuration (model, sensitivity, enabled, endpoint).
aiConfigRoutes.get('/ai-config', async (_req, res) => {
  res.json(await getAiConfig());
});

const aiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.enum(['llama3', 'mistral', 'disabled']).optional(),
  endpoint: z.string().url().optional(),
  sensitivity: z.number().int().min(0).max(100).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

// POST update AI configuration from the dashboard sliders.
aiConfigRoutes.post('/ai-config', async (req, res) => {
  const parsed = aiConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const patch = { ...parsed.data };
  // "disabled" model acts as a hard off-switch.
  if (patch.model === 'disabled') patch.enabled = false;
  const saved = await saveAiConfig(patch);
  res.json(saved);
});

/**
 * Extended live system stats for the dashboard (RAM/CPU). Merge these fields
 * into the existing GET /status response.
 */
export function systemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const load = os.loadavg(); // [1m, 5m, 15m]
  const cpuCount = os.cpus().length;
  return {
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
  };
}
