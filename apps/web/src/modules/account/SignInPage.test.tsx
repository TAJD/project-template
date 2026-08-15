import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignInPage } from './SignInPage';
import { AuthApiError, signIn } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, signIn: vi.fn() };
});

const signInMock = vi.mocked(signIn);

describe('SignInPage', () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it('submits email and password to signIn', async () => {
    signInMock.mockResolvedValue({ user: { id: '1', email: 'a@b.com' } });

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signInMock).toHaveBeenCalledWith('a@b.com', 'password1'));
  });

  it('shows the server error message on failure', async () => {
    signInMock.mockRejectedValue(new AuthApiError('Unauthorized', 401));

    render(<SignInPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Unauthorized');
  });
});
