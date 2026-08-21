import { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useUser } from '../account/useUser';
import { AuthApiError } from '../account/api';
import { useSubscription } from './useSubscription';
import { openBillingPortal, startCheckout } from './api';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function UpgradeCard() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUpgrade() {
    setError(null);
    setSubmitting(true);
    try {
      const { url } = await startCheckout();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Upgrade</h1>
      <p className="mt-2 text-muted">Unlock the gated content with a subscription.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      <Button className="mt-4" onClick={() => void handleUpgrade()} disabled={submitting}>
        {submitting ? 'Redirecting…' : 'Upgrade'}
      </Button>
    </Card>
  );
}

function ManageSubscriptionCard() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleManage() {
    setError(null);
    setSubmitting(true);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof AuthApiError ? err.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">You&rsquo;re subscribed</h1>
      <p className="mt-2 text-muted">Manage your billing details and payment method.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      <Button className="mt-4" onClick={() => void handleManage()} disabled={submitting}>
        {submitting ? 'Redirecting…' : 'Manage billing'}
      </Button>
    </Card>
  );
}

export function PricingPage() {
  const { state: userState } = useUser();
  const { state: subscriptionState } = useSubscription();

  if (userState.status === 'loading' || subscriptionState.status === 'loading') return null;

  if (userState.status !== 'authenticated') {
    return (
      <Card className="mx-auto max-w-sm">
        <p role="alert" className="text-error">
          Sign in to upgrade.
        </p>
      </Card>
    );
  }

  if (subscriptionState.status === 'error') {
    return (
      <Card className="mx-auto max-w-sm">
        <p role="alert" className="text-error">
          {subscriptionState.error}
        </p>
      </Card>
    );
  }

  const subscription = subscriptionState.status === 'ready' ? subscriptionState.subscription : null;
  const isActive = Boolean(subscription && ACTIVE_STATUSES.has(subscription.status));

  return isActive ? <ManageSubscriptionCard /> : <UpgradeCard />;
}
