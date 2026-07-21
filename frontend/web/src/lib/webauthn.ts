import { setToken } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function req(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(`${API_URL}/api${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export async function registerWebAuthn(userId: string, userName: string): Promise<void> {
  const optionsRes = await req('/auth/webauthn/register', 'POST', { userId, userName });
  if (!optionsRes.ok) throw new Error('Registrierung konnte nicht gestartet werden');
  const options = await optionsRes.json();

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: b64ToBytes(options.challenge),
      rp: { name: 'PrivMail', id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      attestation: 'none',
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAttestationResponse;
  const verifyRes = await req('/auth/webauthn/verify', 'POST', {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  });
  if (!verifyRes.ok) throw new Error('Verifizierung fehlgeschlagen');
}

export async function loginWebAuthn(): Promise<{ token: string; user: unknown }> {
  const optionsRes = await fetch(`${API_URL}/api/auth/webauthn/login`, { credentials: 'include' });
  if (!optionsRes.ok) throw new Error('Login konnte nicht gestartet werden');
  const options = await optionsRes.json();

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: b64ToBytes(options.challenge),
      rpId: window.location.hostname,
      userVerification: 'required',
    },
  })) as PublicKeyCredential;

  const response = credential.response as AuthenticatorAssertionResponse;
  const verifyRes = await req('/auth/webauthn/verify-login', 'POST', {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  });
  if (!verifyRes.ok) throw new Error('Login-Verifizierung fehlgeschlagen');
  const result = await verifyRes.json();
  if (result.token) setToken('cookie-managed');
  return result;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
