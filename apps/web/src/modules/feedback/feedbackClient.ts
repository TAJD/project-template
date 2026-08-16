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

export async function submitFeedback(payload: FeedbackPayload): Promise<Response> {
  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  const token = import.meta.env.VITE_FEEDBACK_TOKEN;

  if (!endpoint) {
    throw new Error('VITE_FEEDBACK_ENDPOINT is not set');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  // `fetch` only rejects on a network-level failure, so without this an
  // endpoint answering 401 (wrong token), 429 (rate limited) or 500 would
  // still look like a successful submission to the caller.
  if (!response.ok) {
    throw new Error(`Feedback endpoint responded with ${response.status}`);
  }

  return response;
}
