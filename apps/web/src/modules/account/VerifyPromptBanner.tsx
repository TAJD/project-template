import { useState } from 'react';
import { Button } from '../../components/Button';
import { AuthApiError, requestEmailVerification } from './api';
import { useUser } from './useUser';

export function VerifyPromptBanner() {
  const { state } = useUser();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'authenticated' || state.user.emailVerified) return null;

  async function handleResend() {
    setSending(true);
    setError(null);
    try {
      await requestEmailVerification();
      setSent(true);
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-elev px-4 py-2 text-sm"
    >
      <span>
        {sent ? 'Verification email sent — check your inbox.' : 'Please verify your email address.'}
      </span>
      {!sent && (
        <div className="flex items-center gap-2">
          {error && (
            <span role="alert" className="text-error">
              {error}
            </span>
          )}
          <Button type="button" variant="secondary" onClick={handleResend} disabled={sending}>
            {sending ? 'Sending…' : 'Resend email'}
          </Button>
        </div>
      )}
    </div>
  );
}
