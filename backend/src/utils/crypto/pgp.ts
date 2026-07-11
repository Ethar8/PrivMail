import * as openpgp from 'openpgp';

export interface GeneratedKeyPair {
  publicKey: string;
  privateKey: string;
  revocationCertificate: string;
}

export async function generatePGPKey(
  name: string,
  email: string,
  passphrase: string,
): Promise<GeneratedKeyPair> {
  const { publicKey, privateKey, revocationCertificate } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name, email }],
    passphrase,
    format: 'armored',
  });
  return { publicKey, privateKey, revocationCertificate };
}

// Alias matching the original spec naming.
export const generateKeyPair = generatePGPKey;

export async function encryptMessage(
  message: string,
  recipientPublicKey: string,
  senderPrivateKey?: string,
  passphrase?: string,
): Promise<string> {
  const encryptionKeys = await openpgp.readKey({ armoredKey: recipientPublicKey });
  const signingKeys =
    senderPrivateKey && passphrase
      ? await openpgp.decryptKey({
          privateKey: await openpgp.readPrivateKey({ armoredKey: senderPrivateKey }),
          passphrase,
        })
      : undefined;
  return (await openpgp.encrypt({
    message: await openpgp.createMessage({ text: message }),
    encryptionKeys,
    signingKeys,
    format: 'armored',
  })) as string;
}

export async function decryptMessage(
  encryptedMessage: string,
  privateKey: string,
  passphrase: string,
): Promise<string> {
  const decKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
    passphrase,
  });
  const message = await openpgp.readMessage({ armoredMessage: encryptedMessage });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: decKey });
  return data as string;
}

export async function signMessage(
  text: string,
  privateKey: string,
  passphrase: string,
): Promise<string> {
  const signingKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
    passphrase,
  });
  const message = await openpgp.createCleartextMessage({ text });
  return (await openpgp.sign({ message, signingKeys: signingKey, format: 'armored' })) as string;
}
