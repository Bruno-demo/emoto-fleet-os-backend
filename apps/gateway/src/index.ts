import http from 'node:http';
import { randomUUID } from 'node:crypto';
import httpProxy from 'http-proxy';
import jwt from 'jsonwebtoken';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const gatewayPort = Number(process.env.GATEWAY_PORT ?? 8080);
const apiUrl = process.env.GATEWAY_API_URL ?? 'http://localhost:3000';
const corsOrigin = process.env.GATEWAY_CORS_ORIGIN ?? '*';
const corsMethods = process.env.GATEWAY_CORS_METHODS ?? 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const corsHeaders = process.env.GATEWAY_CORS_HEADERS ?? 'Authorization,Content-Type,X-Request-Id';
const rateWindowMs = Number(process.env.GATEWAY_RATE_WINDOW_MS ?? 60_000);
const rateLimitLogin = Number(process.env.GATEWAY_RATE_LIMIT_LOGIN ?? 10);
const rateLimitRegister = Number(process.env.GATEWAY_RATE_LIMIT_REGISTER ?? 5);
const rateLimitPartner = Number(process.env.GATEWAY_RATE_LIMIT_PARTNER ?? 10);
const jwtSecrets = [process.env.JWT_SECRET, process.env.PARTNER_JWT_SECRET].filter(
  (secret): secret is string => Boolean(secret && secret.length > 0),
);

const proxy = httpProxy.createProxyServer({ target: apiUrl, ws: true, changeOrigin: true, xfwd: true });
const rateLimits = new Map<string, { count: number; resetAt: number }>();

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

// Derives the client IP for rate limiting using x-forwarded-for if present.
function getClientIp(req: http.IncomingMessage): string {
  const header = req.headers['x-forwarded-for'];
  if (typeof header === 'string' && header.length > 0) {
    return header.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// Apply CORS headers for browser clients, including preflight handling.
function applyCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', corsMethods);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders);
}

// Identifies gateway paths that do not require auth at the edge.
function isAuthBypassPath(pathname: string): boolean {
  if (pathname === '/health' || pathname === '/healthz') {
    return true;
  }
  if (pathname === '/docs' || pathname === '/docs-json') {
    return true;
  }
  if (pathname.startsWith('/metrics')) {
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
      jwt.verify(token, secret);
      return true;
    } catch {
      return false;
    }
  });
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

proxy.on('proxyRes', (_proxyRes, _req, res) => {
  applyCors(res);
});

proxy.on('error', (error, _req, res) => {
  logger.error({ err: error }, 'proxy_error');
  if (res instanceof http.ServerResponse && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad gateway' }));
  }
});

const server = http.createServer((req, res) => {
  const requestId = ensureRequestId(req);
  res.setHeader('x-request-id', requestId);
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathname = req.url ? new URL(req.url, 'http://gateway').pathname : '/';

  if (pathname === '/health' || pathname === '/healthz') {
    handleHealth(res);
    return;
  }

  if (!enforceRateLimit(req, res, pathname)) {
    return;
  }

  if (!isAuthBypassPath(pathname)) {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    if (!isValidBearerToken(token)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
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
