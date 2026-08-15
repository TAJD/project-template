import type { Database } from '../db';
import { devEmails } from '../db/schema';
import type { Env } from '../env';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

const DEFAULT_FROM = 'no-reply@example.com';

export class ResendSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status} ${await response.text()}`);
    }
  }
}

// Writes to D1 instead of sending, so the full verify/reset flow can be
// driven and asserted on (or read manually at /dev/mailbox) with zero
// external credentials.
export class DevMailboxSender implements EmailSender {
  constructor(private readonly db: Database) {}

  async send(message: EmailMessage): Promise<void> {
    await this.db.insert(devEmails).values({
      id: crypto.randomUUID(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      createdAt: new Date(),
    });
  }
}

export function createEmailSender(env: Env, db: Database): EmailSender {
  if (env.RESEND_API_KEY) {
    return new ResendSender(env.RESEND_API_KEY, env.EMAIL_FROM ?? DEFAULT_FROM);
  }
  return new DevMailboxSender(db);
}
