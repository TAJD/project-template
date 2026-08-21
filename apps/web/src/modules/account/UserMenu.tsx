import { Link } from 'react-router';
import { signOut } from './api';
import { useUser } from './useUser';

export function UserMenu() {
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
