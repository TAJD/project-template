import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { Layout } from './Layout';

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
});
