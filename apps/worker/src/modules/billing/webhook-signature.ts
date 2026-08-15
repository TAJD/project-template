// Stripe's webhook signature scheme (https://docs.stripe.com/webhooks#verify-manually):
// the `Stripe-Signature` header carries `t=<unix seconds>,v1=<hex hmac>[,v0=...]`;
// the signed payload is `${t}.${rawBody}`, HMAC-SHA256'd with the webhook
// secret. This is the entire security boundary for the webhook route — without
// it anyone who finds the URL could POST a fake `customer.subscription.updated`
// event and grant themselves access.
//
// Verification runs against the *raw* request body text, not a re-serialized
// `JSON.stringify(parsed)` — re-encoding can reorder keys or change
// whitespace/number formatting and would make a genuine Stripe signature fail
// to verify, so the caller must pass the exact bytes Stripe sent.

const TOLERANCE_SECONDS = 5 * 60;

function parseSignatureHeader(header: string): { timestamp: string; signatures: string[] } | null {
  const parts = header.split(',').map((part) => part.trim());
  let timestamp: string | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't' && value) timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function hexToBytes(hex: string): ArrayBuffer | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

export async function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!header) return false;

  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const { timestamp, signatures } = parsed;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  // Replay protection: a signature is only valid for a short window after
  // Stripe generated it, so a captured request/signature pair stops working
  // shortly after capture even if the secret never rotates.
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signedPayload = new TextEncoder().encode(`${timestamp}.${rawBody}`);

  // `crypto.subtle.verify` does a timing-safe comparison internally, so no
  // manual constant-time compare of hex digests is needed here.
  for (const signature of signatures) {
    const signatureBytes = hexToBytes(signature);
    if (!signatureBytes) continue;
    if (await crypto.subtle.verify('HMAC', key, signatureBytes, signedPayload)) return true;
  }

  return false;
}
