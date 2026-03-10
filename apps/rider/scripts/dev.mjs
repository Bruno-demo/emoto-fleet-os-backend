import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';

const DEFAULT_PORT = 8082;
const MAX_PORT = 8090;
const require = createRequire(import.meta.url);
const expoCliBin = require.resolve('expo/bin/cli');

// Checks whether a TCP port is free for the Expo dev server.
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
}

// Finds the first available Expo dev server port for the rider app.
async function resolvePort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port += 1) {
    try {
      await isPortAvailable(port);
      return port;
    } catch {
      continue;
    }
  }

  throw new Error(`No available rider dev port found in range ${DEFAULT_PORT}-${MAX_PORT}`);
}

// Starts Expo on an available port and forwards shutdown signals.
async function main() {
  const port = await resolvePort();
  if (port !== DEFAULT_PORT) {
    console.warn(`Port ${DEFAULT_PORT} is in use; starting rider app on ${port} instead.`);
  }

  const child = spawn(process.execPath, [expoCliBin, 'start', '--port', String(port)], {
    stdio: 'inherit',
    env: process.env,
  });

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
