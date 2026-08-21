import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';

interface DevEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  createdAt: string;
}

type MailboxState =
  | { status: 'loading' }
  | { status: 'ready'; emails: DevEmail[] }
  | { status: 'not-found' }
  | { status: 'error' };

export function DevMailboxPage() {
  const [state, setState] = useState<MailboxState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dev/mailbox')
      .then((res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: 'not-found' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error' });
          return;
        }
        res
          .json()
          .then((body: { emails: DevEmail[] }) => {
            if (!cancelled) setState({ status: 'ready', emails: body.emails });
          })
          .catch(() => {
            if (!cancelled) setState({ status: 'error' });
          });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return null;
  if (state.status === 'not-found') {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="mt-2 text-muted">This page doesn&rsquo;t exist here.</p>
      </Card>
    );
  }
  if (state.status === 'error') {
    return (
      <Card>
        <p role="alert" className="text-error">
          Couldn&rsquo;t load the dev mailbox.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Dev mailbox</h1>
      <p className="text-muted">
        Emails sent by DevMailboxSender in this environment (no RESEND_API_KEY configured).
      </p>
      {state.emails.length === 0 && <p className="text-muted">No emails yet.</p>}
      {state.emails.map((email) => (
        <Card key={email.id}>
          <p className="text-sm text-muted">
            To: {email.to} &middot; {new Date(email.createdAt).toLocaleString()}
          </p>
          <h2 className="mt-1 font-semibold">{email.subject}</h2>
          <pre className="mt-2 whitespace-pre-wrap text-sm">{email.text}</pre>
        </Card>
      ))}
    </div>
  );
}
