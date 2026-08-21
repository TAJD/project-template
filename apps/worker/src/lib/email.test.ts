import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../db';
import { createEmailSender, DevMailboxSender, ResendSender } from './email';

const message = {
  to: 'someone@example.com',
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
};

describe('DevMailboxSender', () => {
  it('writes the message to the dev_emails table instead of sending it', async () => {
    const db = createDb(env.DB);
    const sender = new DevMailboxSender(db);

    await sender.send(message);

    const row = await env.DB.prepare('SELECT * FROM dev_emails').first<{
      to: string;
      subject: string;
    }>();
    expect(row?.to).toBe('someone@example.com');
    expect(row?.subject).toBe('Hello');
  });
});

describe('ResendSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the message to the Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const sender = new ResendSender('test-key', 'from@example.com');
    await sender.send(message);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) as unknown,
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      from: string;
      to: string;
    };
    expect(body.from).toBe('from@example.com');
    expect(body.to).toBe('someone@example.com');
  });

  it('throws when the Resend API responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })));

    const sender = new ResendSender('test-key', 'from@example.com');

    await expect(sender.send(message)).rejects.toThrow(/Resend API error/);
  });
});

describe('createEmailSender', () => {
  it('picks DevMailboxSender when RESEND_API_KEY is unset', () => {
    const db = createDb(env.DB);
    const sender = createEmailSender({ ...env, RESEND_API_KEY: undefined }, db);

    expect(sender).toBeInstanceOf(DevMailboxSender);
  });

  it('picks ResendSender when RESEND_API_KEY is set', () => {
    const db = createDb(env.DB);
    const sender = createEmailSender({ ...env, RESEND_API_KEY: 'a-real-key' }, db);

    expect(sender).toBeInstanceOf(ResendSender);
  });
});
