// The feedback module is env-gated by design: unset VITE_FEEDBACK_ENDPOINT
// means "no feedback source configured yet" for this stamp of the template,
// and the widget renders nothing rather than erroring. VITE_FEEDBACK_TOKEN
// is a lightweight anti-spam token, not a secret — Vite bakes all VITE_*
// vars into the client bundle, so it is inherently public (see
// docs/modules/feedback.md).
export interface FeedbackPayload {
  rating: 'up' | 'down' | null;
  comment?: string;
  page: string;
}

export function isFeedbackEnabled(): boolean {
  return Boolean(import.meta.env.VITE_FEEDBACK_ENDPOINT);
}

export function submitFeedback(payload: FeedbackPayload): Promise<Response> {
  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  const token = import.meta.env.VITE_FEEDBACK_TOKEN;

  if (!endpoint) {
    return Promise.reject(new Error('VITE_FEEDBACK_ENDPOINT is not set'));
  }

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}
