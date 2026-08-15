import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { Layout, initialTheme } from './Layout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>Page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders header, nav, footer, and the routed outlet content', () => {
    renderLayout();

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByText('Page content')).toBeTruthy();
  });

  it('toggles data-theme on <html> and persists the choice to localStorage', () => {
    renderLayout();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: /dark mode/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('falls back to the OS colour-scheme preference when nothing is persisted', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(prefers-color-scheme: dark)' })),
    );

    renderLayout();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    vi.unstubAllGlobals();
  });

  it('reads a previously persisted theme from localStorage on mount', () => {
    localStorage.setItem('theme', 'dark');

    renderLayout();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /light mode/i })).toBeTruthy();
  });

  it('shows sign-in/sign-up links when unauthenticated', async () => {
    renderLayout();

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeTruthy();
  });

  it('shows the user email and a sign-out control when authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ user: { id: '1', email: 'a@b.com' } }), { status: 200 }),
        ),
    );

    renderLayout();

    expect(await screen.findByText('a@b.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('does not throw and defaults to light when window is unavailable (SSR/prerender)', () => {
    vi.stubGlobal('window', undefined);

    expect(() => initialTheme()).not.toThrow();
    expect(initialTheme()).toBe('light');

    vi.unstubAllGlobals();
  });
});
