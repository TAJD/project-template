import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { GatedSamplePage } from './GatedSamplePage';
import { useUser } from '../account/useUser';
import { useSubscription } from './useSubscription';
import { startCheckout } from './api';

vi.mock('../account/useUser', () => ({ useUser: vi.fn() }));
vi.mock('./useSubscription', () => ({ useSubscription: vi.fn() }));
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, startCheckout: vi.fn() };
});

const useUserMock = vi.mocked(useUser);
const useSubscriptionMock = vi.mocked(useSubscription);
const startCheckoutMock = vi.mocked(startCheckout);

function authenticated() {
  useUserMock.mockReturnValue({
    state: { status: 'authenticated', user: { id: '1', email: 'me@example.com' } },
    refresh: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GatedSamplePage />
    </MemoryRouter>,
  );
}

const originalLocation = window.location;

describe('GatedSamplePage', () => {
  beforeEach(() => {
    useUserMock.mockReset();
    useSubscriptionMock.mockReset();
    startCheckoutMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('renders nothing while the user is loading', () => {
    useUserMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    const { container } = renderPage();
    expect(container.textContent).toBe('');
  });

  it('shows a register/sign-in prompt when signed out', () => {
    useUserMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });

    renderPage();

    expect(screen.getByRole('link', { name: 'Register' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText(/Welcome, member/i)).toBeNull();
  });

  it('shows the paywall with a Subscribe CTA when signed in but unpaid', async () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: { status: 'ready', subscription: null },
      refresh: vi.fn(),
    });
    startCheckoutMock.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

    renderPage();

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeTruthy();
    expect(screen.queryByText(/Welcome, member/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/x'));
  });

  it('treats a canceled subscription as unpaid, showing the paywall', () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: {
        status: 'ready',
        subscription: { status: 'canceled', priceId: 'price_1', currentPeriodEnd: '2030-01-01' },
      },
      refresh: vi.fn(),
    });

    renderPage();

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeTruthy();
  });

  it('shows the sample premium content when the subscription is active', () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: {
        status: 'ready',
        subscription: { status: 'active', priceId: 'price_1', currentPeriodEnd: '2030-01-01' },
      },
      refresh: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/Welcome, member/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
  });

  it('shows the sample premium content when trialing', () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: {
        status: 'ready',
        subscription: { status: 'trialing', priceId: 'price_1', currentPeriodEnd: '2030-01-01' },
      },
      refresh: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/Welcome, member/i)).toBeTruthy();
  });
});
