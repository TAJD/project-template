import { render, screen, waitFor } from '@testing-library/react';
import { DevMailboxPage } from './DevMailboxPage';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('DevMailboxPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists emails from the dev mailbox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          emails: [
            {
              id: '1',
              to: 'a@b.com',
              subject: 'Verify your email address',
              html: '<p>hi</p>',
              text: 'hi',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );

    render(<DevMailboxPage />);

    expect(await screen.findByText('Verify your email address')).toBeTruthy();
    expect(screen.getByText(/a@b.com/)).toBeTruthy();
  });

  it('shows a not-found state when the route 404s (prod mode)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    render(<DevMailboxPage />);

    await waitFor(() => expect(screen.getByText('Not found')).toBeTruthy());
  });
});
