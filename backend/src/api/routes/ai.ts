import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

export const aiRouter = Router();

aiRouter.use(requireAuth);

/**
 * The AI assistant runs client-side against a user-provided provider (OpenAI or
 * a local Ollama endpoint), so email content is never sent through PrivMail's
 * servers. This endpoint exposes only non-sensitive metadata.
 */
aiRouter.get('/providers', (_req, res) => {
  res.json({
    providers: [
      { id: 'ollama', label: 'Ollama (lokal)', requiresApiKey: false },
      { id: 'openai', label: 'OpenAI', requiresApiKey: true },
      { id: 'custom', label: 'Eigener OpenAI-kompatibler Endpoint', requiresApiKey: true },
    ],
    clientSide: true,
  });
});
