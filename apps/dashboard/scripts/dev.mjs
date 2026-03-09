import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

const DEFAULT_PORT = 3001;
const MAX_PORT = 3010;

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const LOCK_PATH = path.join(process.cwd(), '.next', 'dev', 'lock');
const STALE_LOCK_MAX_AGE_MS = 5 * 60 * 1000;

// Checks whether a TCP port is currently free for the dashboard dev server.
async function isPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      server.close(() => {
        resolve(error);
      });
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(null);
      });
    });

    server.listen(port);
  }).then((error) => {
    if (error) {
      throw error;
    }
  });

  return true;
}

// Checks whether a process appears to be running for the given pid.
function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

// Ensures a stale Next.js dev lock does not block the server start.
function ensureDevLockIsClear() {
  if (!fs.existsSync(LOCK_PATH)) {
    return;
  }

  let mtimeMs = 0;
  try {
    const stats = fs.statSync(LOCK_PATH);
    mtimeMs = stats.mtimeMs;
  } catch {
    // If we cannot stat the lock, treat it as active and exit.
    console.error(
      'Unable to stat .next/dev/lock. Another next dev instance is likely running.',
    );
    process.exit(1);
  }

  let contents = '';
  try {
    contents = fs.readFileSync(LOCK_PATH, 'utf8').trim();
  } catch {
    const isStale = Date.now() - mtimeMs > STALE_LOCK_MAX_AGE_MS;
    if (!isStale) {
      console.error(
        'Unable to access .next/dev/lock. Another next dev instance is likely running.',
      );
      process.exit(1);
    }

    try {
      fs.rmSync(LOCK_PATH, { force: true });
      return;
    } catch {
      console.error(
        'Failed to remove stale .next/dev/lock. Remove it manually and retry.',
      );
      process.exit(1);
    }
  }

  const pid = Number(contents);
  if (Number.isFinite(pid) && isProcessAlive(pid)) {
    console.error(
      `Next dev appears to be running already (pid ${pid}). Stop it before starting a new instance.`,
    );
    process.exit(1);
  }

  try {
    fs.rmSync(LOCK_PATH, { force: true });
  } catch {
    console.error(
      'Failed to remove stale .next/dev/lock. Remove it manually and retry.',
    );
    process.exit(1);
  }
}

// Finds the first available dashboard dev port starting from 3001.
async function resolveDashboardPort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port += 1) {
    try {
      await isPortAvailable(port);
      return port;
    } catch {
      continue;
    }
  }

  throw new Error(
    `No available dashboard dev port found in range ${DEFAULT_PORT}-${MAX_PORT}`,
  );
}

// Starts Next.js dev server on an available port and forwards exit signals.
async function main() {
  ensureDevLockIsClear();

  const port = await resolveDashboardPort();
  if (port !== DEFAULT_PORT) {
    console.warn(
      `Port ${DEFAULT_PORT} is in use; starting dashboard on ${port} instead.`,
    );
  }

  const child = spawn(
    process.execPath,
    [nextBin, 'dev', '--port', String(port)],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => {
    forwardSignal('SIGINT');
  });
  process.on('SIGTERM', () => {
    forwardSignal('SIGTERM');
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

void main();
