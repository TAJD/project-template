import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router';
import { BottomTabBar } from './BottomTabBar';
import { Search } from './Search';
import { useUser, signOut, VerifyPromptBanner } from '../modules/account';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function UserMenu() {
  const { state } = useUser();

  if (state.status === 'loading') return null;

  if (state.status === 'unauthenticated' || state.status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link to="/sign-in">Sign in</Link>
        <Link to="/sign-up">Sign up</Link>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">{state.user.email}</span>
      <Link to="/settings">Settings</Link>
      <button type="button" onClick={handleSignOut} className="underline">
        Sign out
      </button>
    </div>
  );
}

export function Layout() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-rule px-4 py-3">
        <Link to="/" className="text-lg font-semibold">
          Exemplar
        </Link>
        <nav aria-label="Main" className="hidden gap-4 md:flex">
          <Link to="/">Home</Link>
          <Link to="/blog">Blog</Link>
          {/* Members is in the main nav (rather than reached only via
              pricing/account) because it's the deliberate account+billing
              proof surface (PT-15) — it should be one click away for anyone
              checking the example site still works, not buried. */}
          <Link to="/members">Members</Link>
        </nav>
        <div className="flex items-center gap-2">
          <UserMenu />
          <Search />
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-rule px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>

      <VerifyPromptBanner />

      <main className="flex-1 px-4 py-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      <footer className="border-t border-rule px-4 py-3 text-sm text-muted">
        &copy; {new Date().getFullYear()} Exemplar
      </footer>

      <BottomTabBar />
    </div>
  );
}
