import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AuthApiError, resetPassword } from './api';

export function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      window.location.href = '/sign-in';
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Card className="mx-auto max-w-sm">
        <p role="alert" className="text-error">
          Invalid or expired reset link.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </Card>
  );
}
