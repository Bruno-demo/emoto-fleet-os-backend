const net = require('net');

// Configuration
const HOST = '127.0.0.1'; // local loopback inside the container
const PORT = 5013;        // SinoTrack TCP receiver port
const IMEI = '9171082746';

// Generate timestamp elements
const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, '0');
const min = String(now.getUTCMinutes()).padStart(2, '0');
const ss = String(now.getUTCSeconds()).padStart(2, '0');
const timeStr = `${hh}${min}${ss}`;

const dd = String(now.getUTCDate()).padStart(2, '0');
const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
const dateStr = `${dd}${mm}${yy}`;

// Kigali, Rwanda Coordinates (-1.944, 30.061) in DDMM.MMMM / DDDMM.MMMM format
// Lat: -1.944 S -> 01 degree, 56.6400 minutes -> 0156.6400, S
// Lng: 30.061 E -> 30 degree, 03.6600 minutes -> 03003.6600, E
const latStr = '0156.6400';
const latHem = 'S';
const lngStr = '03003.6600';
const lngHem = 'E';

// Construct raw H02 GPRS packet
const packet = `*HQ,${IMEI},V1,${timeStr},A,${latStr},${latHem},${lngStr},${lngHem},000.0,000,${dateStr},FFFFFFFF#`;

console.log(`=== SinoTrack Telemetry Mock Injector ===`);
console.log(`- Target: ${HOST}:${PORT}`);
console.log(`- Device IMEI: ${IMEI}`);
console.log(`- Generated Packet: ${packet}`);

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log('Connected to GPRS server successfully.');
  console.log('Sending mock telemetry packet...');
  client.write(packet, 'ascii');
});

client.on('data', (data) => {
  console.log(`Received from server: ${data.toString()}`);
  client.destroy(); // kill client after server responds
});

client.on('close', () => {
  console.log('Connection closed.');
});

client.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
});
