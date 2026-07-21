import { SrpClient } from '@/lib/srp';

describe('SrpClient', () => {
  it('exposes client public key without sending the password', () => {
    const client = new SrpClient('user@example.com', 'super-secret-password');
    const A = client.getClientPublicKey();
    expect(typeof A).toBe('string');
    expect(BigInt(A) > 0n).toBe(true);
  });

  it('rejects invalid server public key B ≡ 0 (mod N)', async () => {
    const client = new SrpClient('user@example.com', 'password');
    const salt = Buffer.alloc(16, 7).toString('hex');
    await expect(client.processChallenge(salt, '0')).rejects.toThrow(/Invalid server public key/);
  });

  it('verifyServerProof returns boolean', () => {
    const client = new SrpClient('user@example.com', 'password');
    const shared = new Uint8Array(32);
    expect(client.verifyServerProof('deadbeef', shared)).toBe(false);
  });
});
