import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PricingPage } from './PricingPage';
import { useUser } from '../account/useUser';
import { useSubscription } from './useSubscription';
import { openBillingPortal, startCheckout } from './api';

vi.mock('../account/useUser', () => ({ useUser: vi.fn() }));
vi.mock('./useSubscription', () => ({ useSubscription: vi.fn() }));
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, startCheckout: vi.fn(), openBillingPortal: vi.fn() };
});

const useUserMock = vi.mocked(useUser);
const useSubscriptionMock = vi.mocked(useSubscription);
const startCheckoutMock = vi.mocked(startCheckout);
const openBillingPortalMock = vi.mocked(openBillingPortal);

function authenticated() {
  useUserMock.mockReturnValue({
    state: { status: 'authenticated', user: { id: '1', email: 'me@example.com' } },
    refresh: vi.fn(),
  });
}

const originalLocation = window.location;

describe('PricingPage', () => {
  beforeEach(() => {
    useUserMock.mockReset();
    useSubscriptionMock.mockReset();
    startCheckoutMock.mockReset();
    openBillingPortalMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('renders nothing while user or subscription is loading', () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    const { container } = render(<PricingPage />);
    expect(container.textContent).toBe('');
  });

  it('prompts sign-in when unauthenticated', () => {
    useUserMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });
    useSubscriptionMock.mockReturnValue({ state: { status: 'unauthenticated' }, refresh: vi.fn() });
    render(<PricingPage />);
    expect(screen.getByRole('alert').textContent).toMatch(/Sign in/);
  });

  it('shows an upgrade CTA when there is no active subscription', async () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: { status: 'ready', subscription: null },
      refresh: vi.fn(),
    });
    startCheckoutMock.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/x'));
  });

  it('shows a manage-billing CTA when the subscription is active', async () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: {
        status: 'ready',
        subscription: { status: 'active', priceId: 'price_1', currentPeriodEnd: '2030-01-01' },
      },
      refresh: vi.fn(),
    });
    openBillingPortalMock.mockResolvedValue({ url: 'https://billing.stripe.com/x' });

    render(<PricingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/x'));
  });

  it('treats a canceled subscription as not active', () => {
    authenticated();
    useSubscriptionMock.mockReturnValue({
      state: {
        status: 'ready',
        subscription: { status: 'canceled', priceId: 'price_1', currentPeriodEnd: '2030-01-01' },
      },
      refresh: vi.fn(),
    });

    render(<PricingPage />);
    expect(screen.getByRole('button', { name: 'Upgrade' })).not.toBeNull();
  });
});
