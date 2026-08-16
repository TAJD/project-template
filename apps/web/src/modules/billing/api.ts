// Billing depends on account (design spec: "the only inter-module edge is
// billing → account") — reusing `AuthApiError` here rather than defining a
// second near-identical error class for the same HTTP-error-with-status
// shape.
import { AuthApiError } from '../account/api';

export interface Subscription {
  status: string;
  priceId: string;
  currentPeriodEnd: string;
  // Optional so existing PricingPage/GatedSamplePage test fixtures that predate
  // PT-15's cancel-at-period-end story don't all need updating — an absent
  // value reads the same as `false`, matching AuthUser.emailVerified's convention.
  cancelAtPeriodEnd?: boolean;
}

interface SubscriptionResponse {
  subscription: Subscription | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/billing${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
      ) {
        message = (body as { error: string }).error;
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new AuthApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function fetchSubscription(): Promise<SubscriptionResponse> {
  return request('/subscription');
}

export function startCheckout(): Promise<{ url: string }> {
  return request('/checkout', { method: 'POST' });
}

export function openBillingPortal(): Promise<{ url: string }> {
  return request('/portal', { method: 'POST' });
}
