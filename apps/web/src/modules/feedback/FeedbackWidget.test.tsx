import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { FeedbackWidget } from './FeedbackWidget';

function renderWidget(props?: React.ComponentProps<typeof FeedbackWidget>) {
  return render(
    <MemoryRouter initialEntries={['/members']}>
      <FeedbackWidget {...props} />
    </MemoryRouter>,
  );
}

describe('FeedbackWidget', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing when VITE_FEEDBACK_ENDPOINT is unset', () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', '');
    const { container } = renderWidget();
    expect(container.textContent).toBe('');
  });

  it('renders thumbs and a comment box by default when the endpoint is set', () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
    renderWidget();

    expect(screen.getByLabelText('Thumbs up')).toBeTruthy();
    expect(screen.getByLabelText('Thumbs down')).toBeTruthy();
    expect(screen.getByPlaceholderText(/any feedback/i)).toBeTruthy();
  });

  it('hides the thumbs in comment-only mode', () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
    renderWidget({ mode: 'comment-only' });

    expect(screen.queryByLabelText('Thumbs up')).toBeNull();
    expect(screen.queryByLabelText('Thumbs down')).toBeNull();
    expect(screen.getByPlaceholderText(/any feedback/i)).toBeTruthy();
  });

  it('POSTs the expected payload shape when submitted', async () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
    vi.stubEnv('VITE_FEEDBACK_TOKEN', 'tok_123');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByLabelText('Thumbs up'));
    fireEvent.change(screen.getByPlaceholderText(/any feedback/i), {
      target: { value: 'Loved it' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(screen.getByText('Thanks for the feedback.')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ rating: 'up', comment: 'Loved it', page: '/members' }),
      }),
    );
  });

  it('sends a null rating in comment-only mode', async () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    renderWidget({ mode: 'comment-only' });

    fireEvent.change(screen.getByPlaceholderText(/any feedback/i), {
      target: { value: 'Nice post' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(screen.getByText('Thanks for the feedback.')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/feedback',
      expect.objectContaining({
        body: JSON.stringify({ rating: null, comment: 'Nice post', page: '/members' }),
      }),
    );
  });

  it('shows an error message when the request fails', async () => {
    vi.stubEnv('VITE_FEEDBACK_ENDPOINT', 'https://example.com/feedback');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
