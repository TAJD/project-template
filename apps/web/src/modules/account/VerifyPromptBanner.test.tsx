import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VerifyPromptBanner } from './VerifyPromptBanner';
import { useUser } from './useUser';
import { requestEmailVerification } from './api';

vi.mock('./useUser', () => ({ useUser: vi.fn() }));
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, requestEmailVerification: vi.fn() };
});

const useUserMock = vi.mocked(useUser);
const requestEmailVerificationMock = vi.mocked(requestEmailVerification);

describe('VerifyPromptBanner', () => {
  beforeEach(() => {
    useUserMock.mockReset();
    requestEmailVerificationMock.mockReset();
  });

  it('renders nothing while loading', () => {
    useUserMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    const { container } = render(<VerifyPromptBanner />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when unauthenticated', () => {
    useUserMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });
    const { container } = render(<VerifyPromptBanner />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when the user is already verified', () => {
    useUserMock.mockReturnValue({
      state: { status: 'authenticated', user: { id: '1', email: 'a@b.com', emailVerified: true } },
      refresh: vi.fn(),
    });
    const { container } = render(<VerifyPromptBanner />);
    expect(container.textContent).toBe('');
  });

  it('prompts unverified authenticated users to verify and can resend', async () => {
    useUserMock.mockReturnValue({
      state: {
        status: 'authenticated',
        user: { id: '1', email: 'a@b.com', emailVerified: false },
      },
      refresh: vi.fn(),
    });
    requestEmailVerificationMock.mockResolvedValue({ ok: true });

    render(<VerifyPromptBanner />);
    expect(screen.getByText('Please verify your email address.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));

    await waitFor(() => expect(requestEmailVerificationMock).toHaveBeenCalled());
    expect(await screen.findByText(/Verification email sent/)).toBeTruthy();
  });
});
