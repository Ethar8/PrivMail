import { Router, Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { config } from '../../config/config';
import { findById, toPublic } from '../../models/user';
import { CredentialModel } from '../../models/credential';
import { signToken, requireAuth, AuthedRequest } from '../middleware/auth';
import { toBase64Url, fromBase64Url } from '../../utils/helpers';

export const webauthnRouter = Router();

const rpID = config.domain === 'localhost' ? 'localhost' : config.domain;
const rpName = 'PrivMail';
const origin = process.env.WEBAUTHN_ORIGIN ?? `http://${rpID}:8080`;

// Registration – start
webauthnRouter.post('/register', requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = await findById(req.userId!);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

  const existing = await CredentialModel.listByUser(user.id);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: user.id,
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: fromBase64Url(c.credential_id),
      type: 'public-key' as const,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'cross-platform',
    },
  });

  req.session.challenge = options.challenge;
  req.session.webauthnUserId = user.id;
  res.json(options);
});

// Registration – verify
webauthnRouter.post('/verify', requireAuth, async (req: AuthedRequest, res: Response) => {
  const expectedChallenge = req.session.challenge;
  if (!expectedChallenge) return res.status(400).json({ error: 'Keine Challenge in der Session' });

  // Regel 3/4 – Challenge in JEDEM Fall sofort invalidieren (Anti-Replay).
  req.session.challenge = undefined;

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const info = verification.registrationInfo;
      await CredentialModel.create({
        userId: req.userId!,
        credentialId: toBase64Url(info.credentialID),
        publicKey: toBase64Url(info.credentialPublicKey),
        counter: info.counter,
        deviceType: info.credentialDeviceType,
      });
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'Verifizierung fehlgeschlagen' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Authentication – start
webauthnRouter.get('/login', async (req: Request, res: Response) => {
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  req.session.challenge = options.challenge;
  res.json(options);
});

// Authentication – verify
webauthnRouter.post('/verify-login', async (req: Request, res: Response) => {
  const expectedChallenge = req.session.challenge;
  if (!expectedChallenge) return res.status(400).json({ error: 'Keine Challenge in der Session' });

  // Regel 3/4 – Challenge in JEDEM Fall sofort invalidieren (Anti-Replay).
  req.session.challenge = undefined;

  try {
    const credential = await CredentialModel.findByCredentialId(req.body.id);
    if (!credential) return res.status(404).json({ error: 'Credential nicht gefunden' });

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: fromBase64Url(credential.credential_id),
        credentialPublicKey: fromBase64Url(credential.public_key),
        counter: Number(credential.counter),
      },
    });

    if (verification.verified) {
      await CredentialModel.updateCounter(credential.id, verification.authenticationInfo.newCounter);
      const user = await findById(credential.user_id);
      if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      const token = signToken({ userId: user.id, isAdmin: user.is_admin, tv: user.token_version });
      return res.json({ token, user: toPublic(user) });
    }
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
