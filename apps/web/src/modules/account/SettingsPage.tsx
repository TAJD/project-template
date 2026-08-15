import { useState, type FormEvent } from 'react';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AuthApiError, changeEmail, changePassword, deleteAccount } from './api';
import { useUser } from './useUser';

function ChangeEmailSection({
  currentEmail,
  onChanged,
}: {
  currentEmail: string;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await changeEmail(email, password);
      setSuccess(true);
      setEmail('');
      setPassword('');
      onChanged();
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Change email</h2>
      <p className="mt-1 text-sm text-muted">Current email: {currentEmail}</p>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="New email"
          type="email"
          name="new-email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Current password"
          type="password"
          name="email-change-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-muted">
            Email updated — check your new inbox for a verification link.
          </p>
        )}
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? 'Saving…' : 'Save email'}
        </Button>
      </form>
    </Card>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Change password</h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Current password"
          type="password"
          name="current-password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-muted">
            Password updated. You&rsquo;ve been signed out everywhere else.
          </p>
        )}
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? 'Saving…' : 'Save password'}
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountSection({ currentEmail }: { currentEmail: string }) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const confirmed = confirmation === currentEmail;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount(password);
      // Full navigation so every mounted component re-reads the now-cleared
      // session cookie, same as sign-out.
      window.location.href = '/';
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-error">
      <h2 className="text-lg font-semibold text-error">Delete account</h2>
      <p className="mt-1 text-sm text-muted">
        This permanently deletes your account and cannot be undone. Type{' '}
        <strong>{currentEmail}</strong> to confirm.
      </p>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label={`Type "${currentEmail}" to confirm`}
          type="text"
          name="delete-confirmation"
          autoComplete="off"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Input
          label="Current password"
          type="password"
          name="delete-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="secondary"
          disabled={submitting || !confirmed}
          className="self-start"
        >
          {submitting ? 'Deleting…' : 'Delete my account'}
        </Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const { state, refresh } = useUser();

  if (state.status === 'loading') return null;

  if (state.status !== 'authenticated') {
    return (
      <Card className="mx-auto max-w-sm">
        <p role="alert" className="text-error">
          Sign in to manage your account settings.
        </p>
      </Card>
    );
  }

  const { email } = state.user;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h1 className="text-xl font-semibold">Account settings</h1>
      <ChangeEmailSection currentEmail={email} onChanged={refresh} />
      <ChangePasswordSection />
      <DeleteAccountSection currentEmail={email} />
    </div>
  );
}
