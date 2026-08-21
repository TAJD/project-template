import { describe, expect, it } from 'vitest';
import { verifyStripeSignature } from './webhook-signature';

const SECRET = 'whsec_test_secret';

// Reimplements Stripe's signing scheme independently of `webhook-signature.ts`
// so these tests actually exercise the verification logic against a
// known-good reference, rather than being tautological.
async function sign(payload: string, timestamp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('verifyStripeSignature', () => {
  it('accepts a correctly signed payload within the timestamp tolerance', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'test' });
    const now = new Date('2026-01-01T00:00:00Z');
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = await sign(payload, timestamp, SECRET);

    const valid = await verifyStripeSignature(
      payload,
      `t=${timestamp},v1=${signature}`,
      SECRET,
      now,
    );

    expect(valid).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = await sign(JSON.stringify({ id: 'evt_1' }), timestamp, SECRET);

    const valid = await verifyStripeSignature(
      JSON.stringify({ id: 'evt_2' }),
      `t=${timestamp},v1=${signature}`,
      SECRET,
      now,
    );

    expect(valid).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const timestamp = Math.floor(now.getTime() / 1000);
    const payload = JSON.stringify({ id: 'evt_1' });
    const signature = await sign(payload, timestamp, 'whsec_wrong_secret');

    const valid = await verifyStripeSignature(
      payload,
      `t=${timestamp},v1=${signature}`,
      SECRET,
      now,
    );

    expect(valid).toBe(false);
  });

  it('rejects a signature outside the replay-protection tolerance', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const staleTimestamp = Math.floor(now.getTime() / 1000) - 10 * 60;
    const payload = JSON.stringify({ id: 'evt_1' });
    const signature = await sign(payload, staleTimestamp, SECRET);

    const valid = await verifyStripeSignature(
      payload,
      `t=${staleTimestamp},v1=${signature}`,
      SECRET,
      now,
    );

    expect(valid).toBe(false);
  });

  it('rejects a missing signature header', async () => {
    const valid = await verifyStripeSignature('{}', undefined, SECRET);
    expect(valid).toBe(false);
  });

  it('rejects a malformed signature header', async () => {
    const valid = await verifyStripeSignature('{}', 'not-a-valid-header', SECRET);
    expect(valid).toBe(false);
  });
});
