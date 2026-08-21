import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignUpPage } from './SignUpPage';
import { AuthApiError, signUp } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, signUp: vi.fn() };
});

const signUpMock = vi.mocked(signUp);

describe('SignUpPage', () => {
  beforeEach(() => {
    signUpMock.mockReset();
  });

  it('submits email and password to signUp', async () => {
    signUpMock.mockResolvedValue({ user: { id: '1', email: 'a@b.com' } });

    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() => expect(signUpMock).toHaveBeenCalledWith('a@b.com', 'password1'));
  });

  it('shows the server error message on failure', async () => {
    signUpMock.mockRejectedValue(
      new AuthApiError('An account with that email already exists', 400),
    );

    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dupe@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('An account with that email already exists');
  });
});
