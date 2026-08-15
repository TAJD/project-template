const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * True only for `wrangler dev` / the test harness. A deployed Worker is only
 * ever reached on a hostname routed to it by Cloudflare, so this can never be
 * forced true in production by spoofing the Host header.
 */
export function isLocalRequest(url: string): boolean {
  return LOCAL_HOSTNAMES.has(new URL(url).hostname);
}
