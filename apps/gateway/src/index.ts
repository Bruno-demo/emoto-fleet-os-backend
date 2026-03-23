import http from 'node:http';
import { randomUUID } from 'node:crypto';
import httpProxy from 'http-proxy';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const gatewayPort = Number(process.env.GATEWAY_PORT ?? 8080);
const apiUrl = process.env.GATEWAY_API_URL ?? 'http://localhost:3000';
const corsOrigin = process.env.GATEWAY_CORS_ORIGIN ?? '*';
const corsMethods = process.env.GATEWAY_CORS_METHODS ?? 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const corsHeaders = process.env.GATEWAY_CORS_HEADERS ?? 'Authorization,Content-Type,X-Request-Id';

const proxy = httpProxy.createProxyServer({ target: apiUrl, ws: true, changeOrigin: true, xfwd: true });

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

// Apply CORS headers for browser clients, including preflight handling.
function applyCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', corsMethods);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders);
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

  if (req.url === '/health' || req.url === '/healthz') {
    handleHealth(res);
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
