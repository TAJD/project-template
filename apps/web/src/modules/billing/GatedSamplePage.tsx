import { useState } from 'react';
import { Link } from 'react-router';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useUser } from '../account/useUser';
import { AuthApiError } from '../account/api';
import { useSubscription } from './useSubscription';
import { startCheckout } from './api';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

// The example site's living proof that account + billing work together
// end-to-end (PT-15): this page is the one thing worth re-checking after
// every merge, since a break here means the two modules stopped composing.

const primaryLinkClasses =
  'rounded-md bg-accent px-4 py-2 font-medium text-paper transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const secondaryLinkClasses =
  'rounded-md border border-rule bg-elev px-4 py-2 font-medium text-ink transition-opacity hover:bg-rule focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function SignedOutPrompt() {
  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Members</h1>
      <p className="mt-2 text-muted">Sign in or register to view the sample premium content.</p>
      <div className="mt-4 flex gap-2">
        <Link to="/sign-up" className={primaryLinkClasses}>
          Register
        </Link>
        <Link to="/sign-in" className={secondaryLinkClasses}>
          Sign in
        </Link>
      </div>
    </Card>
  );
}

function Paywall() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubscribe() {
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
      <h1 className="text-xl font-semibold">Members-only content</h1>
      <p className="mt-2 text-muted">Subscribe to unlock the sample premium content below.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-error">
          {error}
        </p>
      )}
      <Button className="mt-4" onClick={() => void handleSubscribe()} disabled={submitting}>
        {submitting ? 'Redirecting…' : 'Subscribe'}
      </Button>
    </Card>
  );
}

function PremiumContent() {
  return (
    <Card className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold">Welcome, member</h1>
      <p className="mt-2 text-muted">
        This is the sample premium content — visible only to a subscribed account.
      </p>
    </Card>
  );
}

export function GatedSamplePage() {
  const { state: userState } = useUser();
  const { state: subscriptionState } = useSubscription();

  if (userState.status === 'loading') return null;
  if (userState.status !== 'authenticated') return <SignedOutPrompt />;
  if (subscriptionState.status === 'loading') return null;

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

  return isActive ? <PremiumContent /> : <Paywall />;
}
