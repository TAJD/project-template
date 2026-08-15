export interface AuthUser {
  id: string;
  email: string;
  // Optional (rather than required) so existing signup/login/me mocks in
  // tests that predate email verification don't need updating — a missing
  // value is treated the same as `false` by VerifyPromptBanner.
  emailVerified?: boolean;
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

async function apiRequest<T>(fullPath: string, init?: RequestInit): Promise<T> {
  const response = await fetch(fullPath, {
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

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest(`/api/auth${path}`, init);
}

function accountRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest(`/api/account${path}`, init);
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

export function requestEmailVerification(): Promise<{ ok: true }> {
  return request('/verify/request', { method: 'POST' });
}

export function requestPasswordReset(email: string): Promise<{ ok: true }> {
  return request('/reset/request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  return request(`/reset/${token}`, { method: 'POST', body: JSON.stringify({ password }) });
}

export function changeEmail(email: string, password: string): Promise<AuthResponse> {
  return accountRequest('/email', {
    method: 'PATCH',
    body: JSON.stringify({ email, password }),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return accountRequest('/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function deleteAccount(password: string): Promise<void> {
  return accountRequest('', { method: 'DELETE', body: JSON.stringify({ password }) });
}
