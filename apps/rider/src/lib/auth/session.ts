import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_STORAGE_KEY = 'emoto_rider_access_token';

// Reads the current rider JWT from secure native storage.
export async function readAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_TOKEN_STORAGE_KEY);
}

// Persists the rider JWT into secure native storage.
export async function writeAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE_KEY, token);
}

// Clears the secure JWT entry when a rider logs out or session expires.
export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE_KEY);
}
