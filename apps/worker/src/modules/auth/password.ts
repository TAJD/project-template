const ALGORITHM = 'pbkdf2-sha256';
// OWASP (2023) recommends 600,000+ iterations for PBKDF2-HMAC-SHA256, but
// that costs ~100ms of CPU time (measured), which risks blowing the CPU-time
// limit on Workers' default "bundled" usage model (50ms/request) — the free
// plan (10ms) can't fit any PBKDF2 iteration count worth using. 100,000
// iterations costs ~15-20ms, leaving headroom under the bundled limit while
// still being an order of magnitude above legacy (~10k) defaults. Projects
// on the "unbound" usage model can raise this.
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function deriveBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt);
  return `${ALGORITHM}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const [algorithm, iterationsRaw, saltB64, hashB64] = parts as [string, string, string, string];
  if (algorithm !== ALGORITHM) return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(saltB64);
    expected = fromBase64(hashB64);
  } catch {
    return false;
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
      keyMaterial,
      expected.length * 8,
    ),
  );

  return timingSafeEqual(actual, expected);
}

// crypto.subtle has no built-in constant-time comparator, and node:crypto's
// timingSafeEqual isn't available in workerd — compare every byte
// unconditionally so the branch taken doesn't depend on where the mismatch
// is (length is compared first, but that leaks nothing secret: it's a
// property of the stored hash format, not the guessed password).
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
