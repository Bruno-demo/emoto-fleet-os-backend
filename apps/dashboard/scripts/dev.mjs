import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';

const DEFAULT_PORT = 3001;
const MAX_PORT = 3010;

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

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
