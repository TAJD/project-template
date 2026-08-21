import { useCallback, useEffect, useState } from 'react';
import { AuthApiError, fetchMe, type AuthUser } from './api';

export type UserState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: string };

export interface UseUserResult {
  state: UserState;
  refresh: () => void;
}

export function useUser(): UseUserResult {
  const [state, setState] = useState<UserState>({ status: 'loading' });

  const refresh = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetchMe()
      .then(({ user }) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof AuthApiError && err.status === 401) {
          setState({ status: 'unauthenticated' });
        } else {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);

  return { state, refresh };
}
