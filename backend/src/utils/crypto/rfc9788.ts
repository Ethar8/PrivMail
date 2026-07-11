import * as openpgp from 'openpgp';

/**
 * RFC 9788 – Header Protection for S/MIME / OpenPGP. PrivMail encrypts the
 * sensitive headers (Subject, From, To, Cc, Date) into an encrypted payload so
 * that mail relays only observe the outer, "wrapper" headers. The original
 * headers are restored client-side after decryption.
 */
export interface EncryptedHeaders {
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date?: string;
}

export const OBSCURED_SUBJECT = '[...]';

export async function encryptHeadersRFC9788(
  headers: EncryptedHeaders,
  recipientPublicKey: string,
): Promise<string> {
  const headerData = JSON.stringify(headers);
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: headerData }),
    encryptionKeys: [await openpgp.readKey({ armoredKey: recipientPublicKey })],
    format: 'armored',
  });
  return encrypted as string;
}

export async function decryptHeadersRFC9788(
  encryptedData: string,
  privateKey: string,
  passphrase: string,
): Promise<EncryptedHeaders> {
  const decKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
    passphrase,
  });
  const message = await openpgp.readMessage({ armoredMessage: encryptedData });
  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: [decKey],
  });
  return JSON.parse(data as string) as EncryptedHeaders;
}

/**
 * Builds an outer message that hides the real headers behind neutral wrappers,
 * embedding the RFC 9788 encrypted header block.
 */
export function buildProtectedMessage(encryptedHeaderBlock: string, encryptedBody: string): string {
  return [
    `Subject: ${OBSCURED_SUBJECT}`,
    'X-PrivMail-Header-Protection: RFC9788',
    'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"',
    '',
    '--privmail-protected',
    'Content-Type: application/pgp-encrypted-headers',
    '',
    encryptedHeaderBlock,
    '--privmail-protected',
    'Content-Type: application/octet-stream',
    '',
    encryptedBody,
    '--privmail-protected--',
  ].join('\r\n');
}
