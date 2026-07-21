import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listOidcClients,
  createOidcClient,
  updateOidcClient,
  deleteOidcClient,
  rotateOidcClientSecret,
} from '../../services/oidc-clients';
import { syncOidcClientToAdapter, getOidcIssuer } from '../../services/oidc-provider';

export const oidcClientsRouter = Router();

oidcClientsRouter.use(requireAuth, requireAdmin);

oidcClientsRouter.get('/', async (_req, res) => {
  res.json({
    issuer: getOidcIssuer(),
    discovery: `${getOidcIssuer()}/.well-known/openid-configuration`,
    clients: await listOidcClients(),
  });
});

const createSchema = z.object({
  clientId: z.string().min(2).max(128).optional(),
  name: z.string().min(1).max(128),
  redirectUris: z.array(z.string().min(1)).min(1),
  postLogoutRedirectUris: z.array(z.string()).optional(),
  scope: z.string().optional(),
});

oidcClientsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const client = await createOidcClient(parsed.data);
    await syncOidcClientToAdapter(client.clientId);
    res.status(201).json({ client });
  } catch (err) {
    res.status(409).json({ error: (err as Error).message || 'Client already exists' });
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  redirectUris: z.array(z.string().min(1)).min(1).optional(),
  postLogoutRedirectUris: z.array(z.string()).optional(),
  scope: z.string().optional(),
  isActive: z.boolean().optional(),
});

oidcClientsRouter.put('/:clientId', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const client = await updateOidcClient(req.params.clientId, parsed.data);
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  await syncOidcClientToAdapter(client.clientId, !client.isActive);
  res.json({ client });
});

oidcClientsRouter.post('/:clientId/rotate-secret', async (req, res) => {
  const client = await rotateOidcClientSecret(req.params.clientId);
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  await syncOidcClientToAdapter(client.clientId);
  res.json({ client });
});

oidcClientsRouter.delete('/:clientId', async (req, res) => {
  await syncOidcClientToAdapter(req.params.clientId, true);
  const ok = await deleteOidcClient(req.params.clientId);
  if (!ok) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  res.json({ ok: true });
});
