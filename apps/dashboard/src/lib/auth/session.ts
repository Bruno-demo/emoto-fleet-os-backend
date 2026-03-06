const AUTH_TOKEN_STORAGE_KEY = 'emoto_dashboard_access_token';

// Reads the current JWT from session storage in browser-safe fashion.
export function readAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

// Persists the JWT in session storage for authenticated API calls.
export function writeAuthToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

// Clears the current session JWT when authentication is invalidated.
export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
