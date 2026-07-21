import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getOidcProvider } from '../../services/oidc-provider';
import { recordOidcLogin } from '../../services/oidc-clients';
import { logger } from '../../utils/logger';

export const oidcInteractionRouter = Router();

/**
 * Returns the pending OIDC interaction details for the login UI.
 * Cookie `_interaction` must be present (set by the authorization redirect).
 */
oidcInteractionRouter.get('/:uid', async (req, res) => {
  try {
    const provider = getOidcProvider();
    const details = await provider.interactionDetails(req, res);
    if (details.uid !== req.params.uid) {
      res.status(400).json({ error: 'Interaction mismatch' });
      return;
    }
    res.json({
      uid: details.uid,
      prompt: details.prompt.name,
      params: {
        client_id: details.params.client_id,
        scope: details.params.scope,
        redirect_uri: details.params.redirect_uri,
      },
      session: details.session
        ? { accountId: details.session.accountId }
        : null,
    });
  } catch (err) {
    logger.warn('OIDC interaction details failed', (err as Error).message);
    res.status(400).json({ error: 'Ungültige oder abgelaufene OIDC-Interaktion' });
  }
});

/**
 * Completes an OIDC interaction after the user authenticated via the
 * existing PrivMail login (SRP / password / WebAuthn). Requires a valid
 * PrivMail session (JWT cookie).
 */
oidcInteractionRouter.post('/:uid/confirm', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const provider = getOidcProvider();
    const details = await provider.interactionDetails(req, res);
    if (details.uid !== req.params.uid) {
      res.status(400).json({ error: 'Interaction mismatch' });
      return;
    }

    const accountId = req.userId!;
    const clientId = String(details.params.client_id ?? '');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Grant = (provider as any).Grant;
    let { grantId } = details;
    let grant = grantId ? await Grant.find(grantId) : undefined;

    if (!grant) {
      grant = new Grant({
        accountId,
        clientId,
      });
    }

    const missingScope = details.prompt.details?.missingOIDCScope as string[] | undefined;
    if (missingScope?.length) {
      grant.addOIDCScope(missingScope.join(' '));
    } else {
      // First-party suite clients: grant standard scopes silently.
      grant.addOIDCScope('openid profile email offline_access');
    }

    const missingClaims = details.prompt.details?.missingOIDCClaims as string[] | undefined;
    if (missingClaims?.length) {
      grant.addOIDCClaims(missingClaims);
    }

    grantId = await grant.save();

    const result = {
      login: { accountId },
      consent: { grantId },
    };

    await recordOidcLogin(clientId, accountId, true);
    await provider.interactionFinished(req, res, result, {
      mergeWithLastSubmission: true,
    });
  } catch (err) {
    logger.error('OIDC interaction confirm failed', (err as Error).message);
    try {
      await recordOidcLogin(
        undefined,
        (req as AuthedRequest).userId ?? 'unknown',
        false,
      );
    } catch {
      /* ignore audit failure */
    }
    res.status(400).json({ error: 'OIDC-Anmeldung konnte nicht abgeschlossen werden' });
  }
});

/**
 * Abort a pending interaction (user cancelled).
 */
oidcInteractionRouter.post('/:uid/abort', async (req, res) => {
  try {
    const provider = getOidcProvider();
    const result = {
      error: 'access_denied',
      error_description: 'End-User aborted interaction',
    };
    await provider.interactionFinished(req, res, result, {
      mergeWithLastSubmission: false,
    });
  } catch (err) {
    logger.warn('OIDC interaction abort failed', (err as Error).message);
    res.status(400).json({ error: 'Interaktion konnte nicht abgebrochen werden' });
  }
});
