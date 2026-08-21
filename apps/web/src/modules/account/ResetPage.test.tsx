import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ResetPage } from './ResetPage';
import { AuthApiError, resetPassword } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, resetPassword: vi.fn() };
});

const resetPasswordMock = vi.mocked(resetPassword);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPage', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
  });

  it('submits the new password with the token from the URL', async () => {
    resetPasswordMock.mockResolvedValue({ ok: true });

    renderAt('/reset-password/abc123');
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'brandnewpass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith('abc123', 'brandnewpass1'));
  });

  it('shows the server error message on failure', async () => {
    resetPasswordMock.mockRejectedValue(new AuthApiError('Invalid or expired reset link', 400));

    renderAt('/reset-password/expired-token');
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'brandnewpass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Invalid or expired reset link');
  });
});
