import * as openpgp from 'openpgp';

/**
 * Local end-to-end encryption for personal data (calendar events, contacts).
 *
 * Uses OpenPGP password-based (symmetric) encryption so no server-side key is
 * ever involved: the plaintext is encrypted in the browser with a passphrase
 * that only the user knows, and only ciphertext (armored PGP messages) is sent
 * to the server. The passphrase is held in memory for the session only.
 */
let sessionPassphrase: string | null = null;

export function setLocalPassphrase(passphrase: string): void {
  sessionPassphrase = passphrase;
}

export function hasLocalPassphrase(): boolean {
  return sessionPassphrase !== null && sessionPassphrase.length > 0;
}

export function clearLocalPassphrase(): void {
  sessionPassphrase = null;
}

function requirePassphrase(): string {
  if (!sessionPassphrase) {
    throw new Error('Kein lokales Passwort gesetzt. Bitte zuerst entsperren.');
  }
  return sessionPassphrase;
}

/** Encrypts a UTF-8 string; returns an armored PGP message. Empty input -> ''. */
export async function encryptLocal(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const passphrase = requirePassphrase();
  const message = await openpgp.createMessage({ text: plaintext });
  return (await openpgp.encrypt({
    message,
    passwords: [passphrase],
    format: 'armored',
  })) as string;
}

/** Decrypts an armored PGP message produced by encryptLocal. Empty input -> ''. */
export async function decryptLocal(armored: string): Promise<string> {
  if (!armored) return '';
  const passphrase = requirePassphrase();
  const message = await openpgp.readMessage({ armoredMessage: armored });
  const { data } = await openpgp.decrypt({
    message,
    passwords: [passphrase],
  });
  return data as string;
}

/** True if a stored value looks like an armored PGP message. */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.includes('BEGIN PGP MESSAGE');
}
