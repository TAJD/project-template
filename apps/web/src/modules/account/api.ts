export interface AuthUser {
  id: string;
  email: string;
}

interface AuthResponse {
  user: AuthUser;
}

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
      ) {
        message = (body as { error: string }).error;
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new AuthApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function signUp(email: string, password: string): Promise<AuthResponse> {
  return request('/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function signIn(email: string, password: string): Promise<AuthResponse> {
  return request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function signOut(): Promise<void> {
  return request('/logout', { method: 'POST' });
}

export function fetchMe(): Promise<AuthResponse> {
  return request('/me');
}
