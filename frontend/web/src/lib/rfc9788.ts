import * as openpgp from 'openpgp';

/**
 * Client-side RFC 9788 header protection. Sensitive headers are encrypted to
 * the recipient's public key and the original headers are hidden behind neutral
 * wrappers before sending. Decryption restores them locally.
 */
export interface ProtectedHeaders {
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date?: string;
}

export const OBSCURED_SUBJECT = '[...]';

export async function encryptHeaders(
  headers: ProtectedHeaders,
  recipientPublicKey: string,
): Promise<string> {
  const message = await openpgp.createMessage({ text: JSON.stringify(headers) });
  return (await openpgp.encrypt({
    message,
    encryptionKeys: [await openpgp.readKey({ armoredKey: recipientPublicKey })],
    format: 'armored',
  })) as string;
}

export async function decryptHeaders(
  encrypted: string,
  privateKey: string,
  passphrase: string,
): Promise<ProtectedHeaders> {
  const decKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
    passphrase,
  });
  const message = await openpgp.readMessage({ armoredMessage: encrypted });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: [decKey] });
  return JSON.parse(data as string) as ProtectedHeaders;
}

/**
 * Builds a full RFC-822 message whose sensitive headers (Subject/From/To/…) are
 * replaced by neutral wrappers and carried, encrypted, inside the body per
 * RFC 9788. Relays only see the obscured Subject and the marker header.
 */
export async function buildProtectedMessage(params: {
  headers: ProtectedHeaders;
  encryptedBody: string;
  recipientPublicKey: string;
}): Promise<string> {
  const encryptedHeaderBlock = await encryptHeaders(params.headers, params.recipientPublicKey);
  const boundary = 'privmail-protected';
  return [
    `From: ${params.headers.from}`,
    `To: ${params.headers.to}`,
    `Subject: ${OBSCURED_SUBJECT}`,
    `Date: ${params.headers.date ?? new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'X-PrivMail-Header-Protection: RFC9788',
    `Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: application/pgp-encrypted-headers',
    '',
    encryptedHeaderBlock,
    `--${boundary}`,
    'Content-Type: application/octet-stream',
    '',
    params.encryptedBody,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}
