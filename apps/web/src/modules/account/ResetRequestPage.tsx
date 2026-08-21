import { useState, type FormEvent } from 'react';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AuthApiError, requestPasswordReset } from './api';

export function ResetRequestPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      // Same confirmation regardless of whether the email is registered —
      // matches the server's enumeration-safe response.
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-sm">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-muted">
          If an account exists for {email}, we&rsquo;ve sent a link to reset your password.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </Card>
  );
}
