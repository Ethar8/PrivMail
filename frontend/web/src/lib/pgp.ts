import * as openpgp from 'openpgp';

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  revocationCertificate: string;
}

export async function generateKeyPair(
  name: string,
  email: string,
  passphrase: string,
): Promise<KeyPair> {
  const { publicKey, privateKey, revocationCertificate } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519',
    userIDs: [{ name, email }],
    passphrase,
    format: 'armored',
  });
  return { publicKey, privateKey, revocationCertificate };
}

export async function encryptMessage(plaintext: string, armoredPublicKey: string): Promise<string> {
  const publicKey = await openpgp.readKey({ armoredKey: armoredPublicKey });
  const message = await openpgp.createMessage({ text: plaintext });
  return (await openpgp.encrypt({ message, encryptionKeys: publicKey, format: 'armored' })) as string;
}

export async function decryptMessage(
  armoredMessage: string,
  armoredPrivateKey: string,
  passphrase: string,
): Promise<string> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey }),
    passphrase,
  });
  const message = await openpgp.readMessage({ armoredMessage });
  const { data } = await openpgp.decrypt({ message, decryptionKeys: privateKey });
  return data as string;
}
