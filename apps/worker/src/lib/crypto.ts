// Shared by session tokens (session.ts) and single-use auth tokens
// (modules/auth/tokens.ts): both need an opaque random token for the client
// to hold, and both store only its hash — the DB is a leak surface, so it
// never holds a value an attacker could replay as-is.

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
