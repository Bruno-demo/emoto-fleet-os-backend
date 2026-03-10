import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';

const DEFAULT_PORT = 8082;
const MAX_PORT = 8090;
const DEFAULT_API_PORT = 3000;
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

// Finds a non-internal IPv4 address so Expo Go can connect over LAN.
function resolveLanAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        candidates.push({ name, address: address.address });
      }
    }
  }

  const preferredWifiMatch = candidates.find((candidate) =>
    /wi-?fi|wlan/i.test(candidate.name),
  );
  if (preferredWifiMatch) {
    return preferredWifiMatch.address;
  }

  const preferredEthernetMatch = candidates.find(
    (candidate) =>
      /ethernet|en\d|eth\d/i.test(candidate.name) &&
      !/vEthernet|wsl|virtualbox|vmware|hyper-v|docker/i.test(candidate.name),
  );
  if (preferredEthernetMatch) {
    return preferredEthernetMatch.address;
  }

  const fallbackMatch = candidates.find(
    (candidate) => !/vEthernet|wsl|loopback|virtualbox|vmware|hyper-v|docker/i.test(candidate.name),
  );
  if (fallbackMatch) {
    return fallbackMatch.address;
  }

  return candidates[0]?.address ?? null;
}

// Resolves the API base URL that rider clients should call in development.
function resolveApiBaseUrl(lanAddress) {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const apiPort = process.env.API_HOST_PORT?.trim() || process.env.PORT?.trim() || String(DEFAULT_API_PORT);

  if (configuredUrl && !/localhost|127\.0\.0\.1/i.test(configuredUrl)) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (lanAddress) {
    return `http://${lanAddress}:${apiPort}`;
  }

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  return `http://localhost:${apiPort}`;
}

// Starts Expo on an available port and forwards shutdown signals.
async function main() {
  const port = await resolvePort();
  if (port !== DEFAULT_PORT) {
    console.warn(`Port ${DEFAULT_PORT} is in use; starting rider app on ${port} instead.`);
  }

  const localUrl = `http://localhost:${port}`;
  const lanAddress = resolveLanAddress();
  const expoGoUrl = lanAddress ? `exp://${lanAddress}:${port}` : null;
  const apiBaseUrl = resolveApiBaseUrl(lanAddress);

  console.log(`Rider Expo dev server: ${localUrl}`);
  if (expoGoUrl) {
    console.log(`Rider Expo Go LAN URL: ${expoGoUrl}`);
  } else {
    console.log('Rider Expo Go LAN URL: unavailable (no non-internal IPv4 address detected)');
  }
  console.log(`Rider API base URL: ${apiBaseUrl}`);
  console.log('Scan the QR code shown by Expo Go after Metro starts.');

  const child = spawn(process.execPath, [expoCliBin, 'start', '--port', String(port)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiBaseUrl,
      EXPO_OFFLINE: process.env.EXPO_OFFLINE ?? '1',
      EXPO_NO_DEPENDENCY_VALIDATION: process.env.EXPO_NO_DEPENDENCY_VALIDATION ?? '1',
      EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? '1',
    },
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
