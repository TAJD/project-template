import { useCallback, useEffect, useState } from 'react';
import { AuthApiError } from '../account/api';
import { fetchSubscription, type Subscription } from './api';

export type SubscriptionState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'ready'; subscription: Subscription | null }
  | { status: 'error'; error: string };

export interface UseSubscriptionResult {
  state: SubscriptionState;
  refresh: () => void;
}

// Reads `GET /api/billing/subscription`, the D1-backed query surface —
// never a live Stripe call, so this hook is safe to poll or refresh freely.
export function useSubscription(): UseSubscriptionResult {
  const [state, setState] = useState<SubscriptionState>({ status: 'loading' });

  const refresh = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetchSubscription()
      .then(({ subscription }) => {
        if (!cancelled) setState({ status: 'ready', subscription });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AuthApiError && err.status === 401) {
          setState({ status: 'unauthenticated' });
        } else {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);

  return { state, refresh };
}
