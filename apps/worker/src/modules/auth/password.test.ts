import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random per-user salt)', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a).not.toBe(b);
  });

  it('encodes the algorithm and iteration count in the stored hash', async () => {
    const hash = await hashPassword('password');
    const [algorithm, iterations] = hash.split('$');
    expect(algorithm).toBe('pbkdf2-sha256');
    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword('password', 'not-a-real-hash')).resolves.toBe(false);
  });
});
