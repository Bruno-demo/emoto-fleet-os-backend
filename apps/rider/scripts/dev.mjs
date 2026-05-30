import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8082;
const MAX_PORT = 8090;
const DEFAULT_API_PORT = 3000;
const require = createRequire(import.meta.url);
const expoCliBin = require.resolve('expo/bin/cli');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const envConfig = {};
try {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        envConfig[key] = value.trim();
      }
    }
  }
} catch (e) {
  // ignore
}

const READY_PATTERNS = [
  /waiting on/i,
  /logs for your project will appear below/i,
  /tunnel ready/i,
  /scan the qr code/i,
];

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
  const configuredUrl = (process.env.EXPO_PUBLIC_API_URL || envConfig.EXPO_PUBLIC_API_URL)?.trim();
  const apiPort = process.env.API_HOST_PORT?.trim() || process.env.PORT?.trim() || String(DEFAULT_API_PORT);

  // If the user explicitly configured an API URL, respect it completely
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (lanAddress) {
    return `http://${lanAddress}:${apiPort}`;
  }

  return `http://localhost:${apiPort}`;
}

// Prints the rider dev URLs once before Expo starts streaming logs.
function printStartupBanner({ localUrl, expoGoUrl, apiBaseUrl }) {
  console.log(`Rider Expo dev server: ${localUrl}`);
  if (expoGoUrl) {
    console.log(`Rider Expo Go LAN URL: ${expoGoUrl}`);
  } else {
    console.log('Rider Expo Go LAN URL: unavailable (no non-internal IPv4 address detected)');
  }
  console.log(`Rider API base URL: ${apiBaseUrl}`);
  console.log('Scan the QR code shown by Expo Go after Metro starts.');
}

// Builds the environment for either the normal online path or the offline fallback.
function buildExpoEnv(apiBaseUrl, offline) {
  return {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiBaseUrl,
    EXPO_OFFLINE: process.env.EXPO_OFFLINE ?? (offline ? '1' : '0'),
    EXPO_NO_DEPENDENCY_VALIDATION: process.env.EXPO_NO_DEPENDENCY_VALIDATION ?? '1',
    EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? '1',
  };
}

// Mirrors Expo child output to the terminal while detecting when the dev server is ready.
function attachStream(stream, target, onChunk) {
  if (!stream) {
    return;
  }

  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    target.write(chunk);
    onChunk(chunk);
  });
}

// Starts a single Expo attempt and rejects only if it dies before startup completes.
function launchExpoAttempt({ apiBaseUrl, offline, port, setActiveChild }) {
  const modeLabel = offline ? 'offline fallback' : 'online';
  const child = spawn(process.execPath, [expoCliBin, 'start', '--port', String(port)], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: buildExpoEnv(apiBaseUrl, offline),
  });
  setActiveChild(child);

  let startupSettled = false;
  let startupReady = false;
  let startupResolve;
  let startupReject;

  const startup = new Promise((resolve, reject) => {
    startupResolve = resolve;
    startupReject = reject;
  });

  const completion = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });

  const markReady = () => {
    if (startupReady) {
      return;
    }

    startupReady = true;
    if (!startupSettled) {
      startupSettled = true;
      startupResolve();
    }
  };

  const handleOutput = (chunk) => {
    if (READY_PATTERNS.some((pattern) => pattern.test(chunk))) {
      markReady();
    }
  };

  attachStream(child.stdout, process.stdout, handleOutput);
  attachStream(child.stderr, process.stderr, handleOutput);

  child.on('error', (error) => {
    if (!startupSettled) {
      startupSettled = true;
      startupReject(new Error(`Expo ${modeLabel} startup failed: ${error.message}`));
    }
  });

  child.on('exit', (code, signal) => {
    if (!startupSettled) {
      startupSettled = true;
      if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') {
        startupResolve();
      } else {
        startupReject(
          new Error(`Expo ${modeLabel} startup failed with code ${code ?? 'unknown'}`),
        );
      }
    }
  });

  return {
    child,
    completion,
    startup,
  };
}

// Runs Expo normally first, then retries once in offline mode if startup fails.
async function main() {
  const port = await resolvePort();
  if (port !== DEFAULT_PORT) {
    console.warn(`Port ${DEFAULT_PORT} is in use; starting rider app on ${port} instead.`);
  }

  const localUrl = `http://localhost:${port}`;
  const lanAddress = resolveLanAddress();
  const expoGoUrl = lanAddress ? `exp://${lanAddress}:${port}` : null;
  const apiBaseUrl = resolveApiBaseUrl(lanAddress);
  let activeChild = null;

  printStartupBanner({ localUrl, expoGoUrl, apiBaseUrl });

  const forwardSignal = (signal) => {
    if (activeChild && !activeChild.killed) {
      activeChild.kill(signal);
    }
  };

  process.on('SIGINT', () => {
    forwardSignal('SIGINT');
  });
  process.on('SIGTERM', () => {
    forwardSignal('SIGTERM');
  });

  const startAttempt = (offline) =>
    launchExpoAttempt({
      apiBaseUrl,
      offline,
      port,
      setActiveChild: (child) => {
        activeChild = child;
      },
    });

  let attempt = startAttempt(false);

  try {
    await attempt.startup;
  } catch (error) {
    console.warn(error.message);
    console.warn('Retrying rider app startup in offline mode.');
    attempt = startAttempt(true);
    await attempt.startup;
  }

  const { code } = await attempt.completion;
  process.exit(code ?? 0);
}

void main();
