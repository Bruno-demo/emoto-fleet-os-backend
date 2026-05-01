import { z } from 'zod';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
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
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(resolveApiUrl(path), {
      ...init,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const body = await parseResponseBody(response);
  if (!response.ok) {
    // If session is expired or invalid (401), redirect to login page.
    if (response.status === 401 && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isGuestPath = ['/login', '/create-account', '/forgot-password'].some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (!isGuestPath) {
        // Redirect to login with expired flag.
        window.location.href = `/login?expired=true&next=${encodeURIComponent(pathname)}`;
      }
    }

    // If access is forbidden (403), redirect to forbidden page.
    if (response.status === 403 && typeof window !== 'undefined') {
      window.location.href = '/forbidden';
    }

    throw new ApiError(
      response.status,
      extractErrorMessage(body, `Request failed with status ${response.status}`),
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
    
    const message = error instanceof Error && error.name === 'AbortError' 
      ? 'Request timed out' 
      : 'Network connection failed';
      
    throw new ApiError(0, message, error);
  }
}
