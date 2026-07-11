import { SMTPCommand } from '../parser';
import { SMTPResponse } from '../response';
import { SMTPSession } from '../session';
import { verifyCredentials } from '../../../models/user';

export interface AuthResult {
  response: string;
  closeAfter: boolean;
}

const b64 = (s: string): string => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s: string): string => Buffer.from(s, 'base64').toString('utf8');

async function finish(session: SMTPSession, username: string, password: string): Promise<AuthResult> {
  session.authState = null;
  const user = await verifyCredentials(username.toLowerCase(), password);
  if (!user) {
    return { response: SMTPResponse.authFailed(), closeAfter: false };
  }
  session.authenticated = true;
  session.user = user.email;
  return { response: SMTPResponse.authSuccess(), closeAfter: false };
}

/**
 * Handles the initial AUTH command. Supports AUTH PLAIN (with optional inline
 * initial response) and AUTH LOGIN (challenge/response). Requires an encrypted
 * channel — the dispatcher enforces STARTTLS before AUTH.
 */
export async function handleAuth(command: SMTPCommand, session: SMTPSession): Promise<AuthResult> {
  if (session.authenticated) {
    return { response: SMTPResponse.badSequence('Already authenticated'), closeAfter: false };
  }
  const parts = command.arg.split(/\s+/);
  const mechanism = (parts[0] ?? '').toUpperCase();
  const initial = parts[1];

  if (mechanism === 'PLAIN') {
    if (initial) {
      return decodePlain(session, initial);
    }
    session.authState = { mechanism: 'PLAIN', stage: 'password' };
    return { response: SMTPResponse.authChallenge(''), closeAfter: false };
  }

  if (mechanism === 'LOGIN') {
    session.authState = { mechanism: 'LOGIN', stage: 'username' };
    // "Username:" base64-encoded
    return { response: SMTPResponse.authChallenge(b64('Username:')), closeAfter: false };
  }

  return { response: SMTPResponse.paramError('Unsupported authentication mechanism'), closeAfter: false };
}

/**
 * Handles a continuation line while an AUTH exchange is in progress.
 */
export async function handleAuthContinuation(line: string, session: SMTPSession): Promise<AuthResult> {
  const state = session.authState;
  if (!state) {
    return { response: SMTPResponse.badSequence('No authentication in progress'), closeAfter: false };
  }
  // Client may abort with "*"
  if (line === '*') {
    session.authState = null;
    return { response: SMTPResponse.paramError('Authentication aborted'), closeAfter: false };
  }

  if (state.mechanism === 'PLAIN') {
    return decodePlain(session, line);
  }

  // LOGIN
  if (state.stage === 'username') {
    let username: string;
    try {
      username = unb64(line);
    } catch {
      session.authState = null;
      return { response: SMTPResponse.authFailed('Malformed username'), closeAfter: false };
    }
    session.authState = { mechanism: 'LOGIN', stage: 'password', username };
    return { response: SMTPResponse.authChallenge(b64('Password:')), closeAfter: false };
  }

  // stage === 'password'
  let password: string;
  try {
    password = unb64(line);
  } catch {
    session.authState = null;
    return { response: SMTPResponse.authFailed('Malformed password'), closeAfter: false };
  }
  return finish(session, state.username ?? '', password);
}

/**
 * PLAIN payload is base64("authzid\0authcid\0password").
 */
async function decodePlain(session: SMTPSession, payload: string): Promise<AuthResult> {
  let decoded: string;
  try {
    decoded = unb64(payload);
  } catch {
    session.authState = null;
    return { response: SMTPResponse.authFailed('Malformed credentials'), closeAfter: false };
  }
  const segments = decoded.split('\0');
  if (segments.length < 3) {
    session.authState = null;
    return { response: SMTPResponse.authFailed('Malformed credentials'), closeAfter: false };
  }
  const username = segments[1];
  const password = segments[2];
  return finish(session, username, password);
}
