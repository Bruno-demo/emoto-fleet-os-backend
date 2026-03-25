const AUTH_TOKEN_STORAGE_KEY = 'emoto_dashboard_access_token';
const AUTH_TOKEN_PERSIST_KEY = 'emoto_dashboard_access_token_persist';

// Reads the current JWT from session storage in browser-safe fashion.
export function readAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (
    window.localStorage.getItem(AUTH_TOKEN_PERSIST_KEY) ||
    window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  );
}

// Persists the JWT in session or local storage depending on the remember flag.
export function writeAuthToken(token: string, options?: { persist?: boolean }): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (options?.persist) {
    window.localStorage.setItem(AUTH_TOKEN_PERSIST_KEY, token);
    window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_PERSIST_KEY);
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

// Clears the current session JWT when authentication is invalidated.
export function clearAuthToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_PERSIST_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
