import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_TOKEN_STORAGE_KEY = 'emoto_rider_access_token';
let memoryAuthToken: string | null = null;

// Returns true when Expo Secure Store can be safely used in the current runtime.
function canUseSecureStore(): boolean {
  return (
    Platform.OS !== 'web' &&
    typeof SecureStore.getItemAsync === 'function' &&
    typeof SecureStore.setItemAsync === 'function' &&
    typeof SecureStore.deleteItemAsync === 'function'
  );
}

// Reads the browser fallback token from localStorage when running on web.
function readWebToken(): string | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return memoryAuthToken;
  }

  return globalThis.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

// Persists the browser fallback token into localStorage when available.
function writeWebToken(token: string): void {
  memoryAuthToken = token;
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  globalThis.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

// Clears the browser fallback token from localStorage and in-memory state.
function clearWebToken(): void {
  memoryAuthToken = null;
  if (typeof globalThis.localStorage === 'undefined') {
    return;
  }

  globalThis.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

// Reads the current rider JWT from secure native storage.
export async function readAuthToken(): Promise<string | null> {
  if (canUseSecureStore()) {
    return SecureStore.getItemAsync(AUTH_TOKEN_STORAGE_KEY);
  }

  return readWebToken();
}

// Persists the rider JWT into secure native storage.
export async function writeAuthToken(token: string): Promise<void> {
  if (canUseSecureStore()) {
    await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token);
    return;
  }

  writeWebToken(token);
}

// Clears the secure JWT entry when a rider logs out or session expires.
export async function clearAuthToken(): Promise<void> {
  if (canUseSecureStore()) {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
    return;
  }

  clearWebToken();
}

export const clearAuthSession = clearAuthToken;

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onUnauthorizedSession(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifyUnauthorizedSession(): void {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}
