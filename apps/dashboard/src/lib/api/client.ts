import { z } from 'zod';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly url?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

interface ApiFetchOptions<T> {
  auth?: boolean;
  schema?: z.ZodType<T>;
}

// Joins relative API paths against the configured backend base URL.
function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// Parses JSON/text response bodies and returns undefined for empty responses.
async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Normalizes backend errors into a human-readable message.
function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const maybeMessage = (body as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
    if (Array.isArray(maybeMessage) && maybeMessage.length > 0) {
      const firstMessage = maybeMessage[0];
      if (typeof firstMessage === 'string' && firstMessage.trim().length > 0) {
        return firstMessage;
      }
    }
  }

  return fallback;
}

// Performs authenticated API requests with optional Zod response validation.
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions<T> = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout for slow/flaky connections and cloud cold starts

  try {
    const resolvedUrl = resolveApiUrl(path);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[apiFetch] Request details:`, {
        path,
        API_BASE_URL,
        resolvedUrl,
        method: init.method || 'GET'
      });
    }

    const response = await fetch(resolvedUrl, {
      ...init,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const body = await parseResponseBody(response);
    if (!response.ok) {
      // If session is expired or invalid (401), redirect to login page.
      if (response.status === 401 && typeof window !== 'undefined' && options.auth !== false) {
        const pathname = window.location.pathname;
        const isGuestPath = ['/login', '/create-account', '/forgot-password', '/reset-password'].some(
          (p) => pathname === p || pathname.startsWith(`${p}/`),
        );
        if (!isGuestPath) {
          // Clear cookie via server logout endpoint first, then redirect to login with expired flag.
          try {
            await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
          } catch {
            // Ignore logout errors
          }
          window.location.href = `/login?expired=true&next=${encodeURIComponent(pathname)}`;
        }
      }

      // If access is forbidden (403) on an HQ admin route, redirect to forbidden page.
      if (response.status === 403 && typeof window !== 'undefined' && window.location.pathname.startsWith('/hq')) {
        window.location.href = '/forbidden';
      }

      let rawMessage = extractErrorMessage(body, 'Request failed. Please try again.');
      if (response.status === 413) {
        rawMessage = 'The request payload or uploaded image is too large. Maximum size allowed is 1MB. Please upload a smaller file.';
      }
      if (response.status !== 401 || options.auth !== false) {
        console.error(`API Error: ${rawMessage}`, {
          url: resolvedUrl,
          status: response.status,
          body,
          diagnostic: {
            path,
            API_BASE_URL,
            resolvedUrl,
          }
        });
      }
      throw new ApiError(
        response.status,
        rawMessage,
        resolvedUrl,
        body,
      );
    }

    if (!options.schema) {
      return body as T;
    }
    return options.schema.parse(body);
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const message = isTimeout 
      ? 'Request timed out. Please check your internet connection.' 
      : 'Network connection failed. Please check your internet connection.';
    
    console.error(`API Fetch Error: ${message}`, {
      url: resolveApiUrl(path),
      error,
    });
      
    throw new ApiError(0, message, resolveApiUrl(path), error);
  }
}
