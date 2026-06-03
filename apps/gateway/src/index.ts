import http from 'node:http';
import { randomUUID } from 'node:crypto';
import httpProxy from 'http-proxy';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const gatewayPort = Number(process.env.GATEWAY_PORT ?? 8080);
const apiUrl = process.env.GATEWAY_API_URL ?? 'http://localhost:3000';
const corsOrigin = process.env.GATEWAY_CORS_ORIGIN ?? '*';
const corsOrigins = corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const nodeEnv = process.env.NODE_ENV ?? 'development';
const authCookieName = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';

// Block wildcard CORS in production to prevent credential leakage.
if (nodeEnv === 'production' && corsOrigin === '*') {
  logger.error('GATEWAY_CORS_ORIGIN must not be * in production');
  process.exit(1);
}
const corsMethods = process.env.GATEWAY_CORS_METHODS ?? 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const corsHeaders = process.env.GATEWAY_CORS_HEADERS ?? 'Authorization,Content-Type,X-Request-Id';
const rateWindowMs = Number(process.env.GATEWAY_RATE_WINDOW_MS ?? 60_000);
const rateLimitLogin = Number(process.env.GATEWAY_RATE_LIMIT_LOGIN ?? 5);
const rateLimitRegister = Number(process.env.GATEWAY_RATE_LIMIT_REGISTER ?? 5);
const rateLimitPartner = Number(process.env.GATEWAY_RATE_LIMIT_PARTNER ?? 5);
const maxRequestBodyBytes = Number(process.env.GATEWAY_MAX_BODY_BYTES ?? 1_048_576); // 1 MB
const proxyTimeoutMs = Number(process.env.GATEWAY_PROXY_TIMEOUT_MS ?? 30_000);
const jwtSecrets = [process.env.JWT_SECRET, process.env.PARTNER_JWT_SECRET].filter(
  (secret): secret is string => Boolean(secret && secret.length > 0),
);

const proxy = httpProxy.createProxyServer({ target: apiUrl, ws: true, changeOrigin: true, xfwd: true, proxyTimeout: proxyTimeoutMs, timeout: proxyTimeoutMs });
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const rateLimitMaxEntries = Number(process.env.GATEWAY_RATE_LIMIT_MAX_ENTRIES ?? 50_000);

// Prunes expired rate limit entries to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of rateLimits) {
    if (state.resetAt <= now) {
      rateLimits.delete(key);
    }
  }
  // Hard cap: if the map is still too large after pruning, drop oldest entries.
  if (rateLimits.size > rateLimitMaxEntries) {
    const excess = rateLimits.size - rateLimitMaxEntries;
    const keys = rateLimits.keys();
    for (let i = 0; i < excess; i++) {
      const next = keys.next();
      if (!next.done) rateLimits.delete(next.value);
    }
    logger.warn({ pruned: excess }, 'rate_limit_map_overflow');
  }
}, 60_000).unref();

// Assign or create a request id so downstream services can correlate logs.
function ensureRequestId(req: http.IncomingMessage): string {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  const id = randomUUID();
  req.headers['x-request-id'] = id;
  return id;
}

const trustProxy = process.env.GATEWAY_TRUST_PROXY === 'true';

// Derives the client IP for rate limiting. Only trusts x-forwarded-for when explicitly configured.
function getClientIp(req: http.IncomingMessage): string {
  if (trustProxy) {
    const header = req.headers['x-forwarded-for'];
    if (typeof header === 'string' && header.length > 0) {
      const candidate = header.split(',')[0].trim();
      if (candidate.length <= 45 && /^[\d.:a-fA-F]+$/.test(candidate)) {
        return candidate;
      }
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// Apply CORS and security headers for browser clients, including preflight handling.
function appendVaryOrigin(res: http.ServerResponse): void {
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', 'Origin');
    return;
  }

  const value = Array.isArray(current) ? current.join(', ') : String(current);
  if (!value.split(',').map((part) => part.trim().toLowerCase()).includes('origin')) {
    res.setHeader('Vary', `${value}, Origin`);
  }
}

// Reflects an allowed browser origin so credentialed requests work through the gateway.
function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const requestOrigin = req.headers.origin;
  const isWildcard = corsOrigins.includes('*');
  const allowedOrigin =
    isWildcard
      ? '*'
      : typeof requestOrigin === 'string' && corsOrigins.includes(requestOrigin)
        ? requestOrigin
        : corsOrigins.length === 1
          ? corsOrigins[0]
          : null;

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    if (allowedOrigin !== '*') {
      appendVaryOrigin(res);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader('Access-Control-Allow-Methods', corsMethods);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
}

// Identifies gateway paths that do not require auth at the edge.
function isAuthBypassPath(pathname: string): boolean {
  if (pathname === '/health' || pathname === '/healthz') {
    return true;
  }
  if (nodeEnv !== 'production' && (pathname === '/docs' || pathname === '/docs-json')) {
    return true;
  }
  if (pathname.startsWith('/socket.io')) {
    return true;
  }
  if (pathname.startsWith('/auth/login')) {
    return true;
  }
  if (pathname.startsWith('/auth/register')) {
    return true;
  }
  if (pathname.startsWith('/auth/send-otp')) {
    return true;
  }
  if (pathname.startsWith('/auth/verify-otp')) {
    return true;
  }
  if (pathname.startsWith('/auth/contact')) {
    return true;
  }
  if (pathname.startsWith('/auth/forgot-password')) {
    return true;
  }
  if (pathname.startsWith('/auth/reset-password')) {
    return true;
  }
  if (pathname.startsWith('/partner/oauth/token')) {
    return true;
  }
  return false;
}

// Validates JWT tokens against configured secrets for both fleet and partner auth.
function isValidBearerToken(token: string | null): boolean {
  if (!token) {
    return false;
  }
  if (jwtSecrets.length === 0) {
    return false;
  }
  return jwtSecrets.some((secret) => {
    try {
      jwt.verify(token, secret, { algorithms: ['HS256'] });
      return true;
    } catch {
      return false;
    }
  });
}

// Parses the Cookie header without requiring a web framework in the gateway.
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    if (!name) {
      return cookies;
    }

    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
    return cookies;
  }, {});
}

// Supports both external bearer clients and browser sessions backed by httpOnly cookies.
function extractAccessToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[authCookieName] ?? null;
}

// Applies rate limits for sensitive endpoints and returns false when blocked.
function enforceRateLimit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): boolean {
  let max = 0;
  if (pathname.startsWith('/auth/login')) {
    max = rateLimitLogin;
  } else if (pathname.startsWith('/auth/register')) {
    max = rateLimitRegister;
  } else if (pathname.startsWith('/partner/oauth/token')) {
    max = rateLimitPartner;
  }

  if (max <= 0) {
    return true;
  }

  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const windowState = rateLimits.get(key);
  if (!windowState || windowState.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }

  windowState.count += 1;
  if (windowState.count > max) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests' }));
    return false;
  }

  return true;
}

// Respond to basic health checks without proxying downstream.
function handleHealth(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'gateway' }));
}

proxy.on('proxyReq', (proxyReq, req) => {
  const requestId = ensureRequestId(req);
  proxyReq.setHeader('x-request-id', requestId);
});

proxy.on('proxyRes', (_proxyRes, req, res) => {
  applyCors(req, res);
});

proxy.on('error', (error, req, res) => {
  logger.error({ err: error }, 'proxy_error');
  if (res instanceof http.ServerResponse && !res.headersSent) {
    applyCors(req, res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad gateway' }));
  }
});

const server = http.createServer((req, res) => {
  const requestId = ensureRequestId(req);
  res.setHeader('x-request-id', requestId);
  applyCors(req, res);
  const requestStart = process.hrtime.bigint();
  const pathname = req.url ? new URL(req.url, 'http://gateway').pathname : '/';

  // Emits structured access logs with request duration.
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - requestStart) / 1_000_000;
    logger.info(
      {
        requestId,
        method: req.method,
        path: pathname,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      },
      'gateway_request',
    );
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/health' || pathname === '/healthz') {
    handleHealth(res);
    return;
  }

  // Block access to internal-only endpoints from external traffic.
  if (pathname === '/metrics' || pathname === '/metrics/') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }
  if (nodeEnv === 'production' && (pathname === '/docs' || pathname === '/docs-json')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  if (!enforceRateLimit(req, res, pathname)) {
    return;
  }

  if (!isAuthBypassPath(pathname)) {
    const token = extractAccessToken(req);
    if (!isValidBearerToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  // Reject requests whose declared Content-Length exceeds the allowed body size.
  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > maxRequestBodyBytes) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payload too large' }));
    return;
  }

  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => {
  ensureRequestId(req);
  proxy.ws(req, socket, head);
});

server.listen(gatewayPort, () => {
  logger.info({ port: gatewayPort, apiUrl }, 'gateway_listening');
});

// Graceful shutdown — drain connections before exiting.
function shutdown(signal: string): void {
  logger.info({ signal }, 'gateway_shutting_down');
  server.close(() => {
    proxy.close();
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
