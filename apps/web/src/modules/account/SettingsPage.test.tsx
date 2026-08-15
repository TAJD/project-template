import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { useUser } from './useUser';
import { AuthApiError, changeEmail, changePassword, deleteAccount } from './api';

vi.mock('./useUser', () => ({ useUser: vi.fn() }));
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
  };
});

const useUserMock = vi.mocked(useUser);
const changeEmailMock = vi.mocked(changeEmail);
const changePasswordMock = vi.mocked(changePassword);
const deleteAccountMock = vi.mocked(deleteAccount);

function authenticated(email = 'me@example.com') {
  useUserMock.mockReturnValue({
    state: { status: 'authenticated', user: { id: '1', email, emailVerified: true } },
    refresh: vi.fn(),
  });
}

// "Current password" appears once per section (email/password/delete), so
// getByLabelText can't disambiguate on text alone — the ids are unique.
function inputById(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`expected an input#${id}`);
  return el;
}

describe('SettingsPage', () => {
  beforeEach(() => {
    useUserMock.mockReset();
    changeEmailMock.mockReset();
    changePasswordMock.mockReset();
    deleteAccountMock.mockReset();
  });

  it('renders nothing while loading', () => {
    useUserMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    const { container } = render(<SettingsPage />);
    expect(container.textContent).toBe('');
  });

  it('prompts sign-in when unauthenticated', () => {
    useUserMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });
    render(<SettingsPage />);
    expect(screen.getByRole('alert').textContent).toMatch(/Sign in/);
  });

  it('submits a new email with the current password', async () => {
    authenticated();
    changeEmailMock.mockResolvedValue({ user: { id: '1', email: 'new@example.com' } });

    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('New email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(inputById('email-change-password'), { target: { value: 'goodpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save email' }));

    await waitFor(() =>
      expect(changeEmailMock).toHaveBeenCalledWith('new@example.com', 'goodpass1'),
    );
    expect(await screen.findByText(/check your new inbox/i)).toBeTruthy();
  });

  it('shows the server error when changing email fails', async () => {
    authenticated();
    changeEmailMock.mockRejectedValue(new AuthApiError('Unauthorized', 401));

    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('New email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(inputById('email-change-password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save email' }));

    const alert = await screen.findByText('Unauthorized');
    expect(alert).toBeTruthy();
  });

  it('submits a password change', async () => {
    authenticated();
    changePasswordMock.mockResolvedValue({ ok: true });

    render(<SettingsPage />);
    fireEvent.change(inputById('current-password'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledWith('oldpass1', 'newpass1'));
    expect(await screen.findByText(/signed out everywhere else/i)).toBeTruthy();
  });

  it('keeps the delete button disabled until the email is typed exactly', () => {
    authenticated('me@example.com');
    render(<SettingsPage />);

    const deleteButton = screen.getByRole('button', {
      name: 'Delete my account',
    }) as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Type "me@example.com" to confirm'), {
      target: { value: 'not-my-email@example.com' },
    });
    expect(deleteButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Type "me@example.com" to confirm'), {
      target: { value: 'me@example.com' },
    });
    expect(deleteButton.disabled).toBe(false);
  });

  it('deletes the account once confirmed and re-authenticated', async () => {
    authenticated('me@example.com');
    deleteAccountMock.mockResolvedValue(undefined);
    const originalLocation = window.location;
    // jsdom doesn't implement navigation; stub it so the full-navigation
    // redirect after delete doesn't throw.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText('Type "me@example.com" to confirm'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.change(inputById('delete-password'), { target: { value: 'goodpass1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledWith('goodpass1'));
    await waitFor(() => expect(window.location.href).toBe('/'));

    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
  });
});
