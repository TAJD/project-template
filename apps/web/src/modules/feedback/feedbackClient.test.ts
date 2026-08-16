import { isFeedbackEnabled, submitFeedback } from './feedbackClient';

describe('feedbackClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('isFeedbackEnabled', () => {
    it('is false when VITE_FEEDBACK_ENDPOINT is unset', () => {
      vi.stubEnv('VITE_FEEDBACK_ENDPOINT', '');
      expect(isFeedbackEnabled()).toBe(false);
    });

    it('is true when VITE_FEEDBACK_ENDPOINT is set', () => {
      vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
      expect(isFeedbackEnabled()).toBe(true);
    });
  });

  describe('submitFeedback', () => {
    it('POSTs the payload to VITE_FEEDBACK_ENDPOINT with a bearer token', async () => {
      vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
      vi.stubEnv('VITE_FEEDBACK_TOKEN', 'tok_123');
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);

      await submitFeedback({ rating: 'up', comment: 'Nice page', page: '/members' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/feedback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            authorization: 'Bearer tok_123',
          }),
          body: JSON.stringify({ rating: 'up', comment: 'Nice page', page: '/members' }),
        }),
      );
    });

    it('omits the authorization header when VITE_FEEDBACK_TOKEN is unset', async () => {
      vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
      vi.stubEnv('VITE_FEEDBACK_TOKEN', '');
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);

      await submitFeedback({ rating: null, comment: 'Thoughts', page: '/blog/post' });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.headers).not.toHaveProperty('authorization');
    });

    it('rejects when the endpoint answers with an error status', async () => {
      vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

      await expect(submitFeedback({ rating: 'up', page: '/members' })).rejects.toThrow(/429/);
    });
  });
});
