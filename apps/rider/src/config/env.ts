const DEFAULT_API_BASE_URL = 'http://localhost:3000';

// Resolves backend URL from Expo public env with a safe local fallback.
function resolveApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();
