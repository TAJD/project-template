import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('/api/health', () => {
  it('returns ok: true', async () => {
    const response = await SELF.fetch('https://example.com/api/health');
    expect(await response.json()).toEqual({ ok: true });
  });
});
