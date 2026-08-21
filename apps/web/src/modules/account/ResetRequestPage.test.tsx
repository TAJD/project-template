import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetRequestPage } from './ResetRequestPage';
import { AuthApiError, requestPasswordReset } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, requestPasswordReset: vi.fn() };
});

const requestPasswordResetMock = vi.mocked(requestPasswordReset);

describe('ResetRequestPage', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('submits the email and shows a generic confirmation', async () => {
    requestPasswordResetMock.mockResolvedValue({ ok: true });

    render(<ResetRequestPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(requestPasswordResetMock).toHaveBeenCalledWith('a@b.com'));
    expect(await screen.findByText('Check your email')).toBeTruthy();
  });

  it('shows the same confirmation even for an unregistered email', async () => {
    requestPasswordResetMock.mockResolvedValue({ ok: true });

    render(<ResetRequestPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Check your email')).toBeTruthy();
  });

  it('shows the server error message on failure', async () => {
    requestPasswordResetMock.mockRejectedValue(new AuthApiError('Too many requests', 429));

    render(<ResetRequestPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Too many requests');
  });
});
