import { z } from 'zod';
import { API_BASE_URL } from '../../config/env';
import { readAuthToken } from '../auth/session';
import { logAppError } from '../monitoring/error-log';

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
  token?: string | null;
}

// Normalizes relative paths against the configured API URL.
function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// Parses text or JSON responses and handles empty/204 responses safely.
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

// Extracts a readable backend error message from common NestJS shapes.
function extractErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  if (body && typeof body === 'object') {
    const messageCandidate = (body as { message?: unknown }).message;
    if (
      typeof messageCandidate === 'string' &&
      messageCandidate.trim().length > 0
    ) {
      return messageCandidate;
    }

    if (Array.isArray(messageCandidate) && messageCandidate.length > 0) {
      const firstMessage = messageCandidate[0];
      if (typeof firstMessage === 'string' && firstMessage.trim().length > 0) {
        return firstMessage;
      }
    }
  }

  return fallback;
}

// Performs API requests with JWT auth, structured errors, and optional Zod validation.
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions<T> = {},
): Promise<T> {
  const shouldAttachAuth = options.auth !== false;
  const token = options.token ?? (shouldAttachAuth ? await readAuthToken() : null);

  if (shouldAttachAuth && !token) {
    throw new ApiError(401, 'Authentication required');
  }

  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (shouldAttachAuth && token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      ...init,
      headers,
    });
  } catch (error: unknown) {
    logAppError('api.network_failure', error, {
      feature: 'api',
      operation: path,
      status: 0,
    });
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Request timed out. Please check your internet connection.'
      : 'Network connection failed. Please check your internet connection.';
      
    throw new ApiError(
      0,
      message,
      error,
    );
  }

  const body = await parseResponseBody(response);
  if (!response.ok) {
    logAppError('api.http_error', body, {
      feature: 'api',
      operation: path,
      status: response.status,
    });
    throw new ApiError(
      response.status,
      extractErrorMessage(body, 'Request failed. Please try again.'),
      body,
    );
  }

  if (!options.schema) {
    return body as T;
  }

  return options.schema.parse(body);
}
