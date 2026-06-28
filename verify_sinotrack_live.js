const { PrismaClient } = require('@prisma/client');
const net = require('net');

const prisma = new PrismaClient();

const TEST_IMEI = '860953020000000';
const PORT = 5013;
const SIMULATION_INTERVAL_MS = 3000; // Send packet every 3 seconds

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Converts standard Decimal Degrees into NMEA ddmm.mmmm/dddmm.mmmm format for SinoTrack
function convertToSinoTrackCoords(lat, lng) {
  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = (absLat - latDeg) * 60;
  const latStr = String(latDeg).padStart(2, '0') + latMin.toFixed(4).padStart(7, '0');
  const latHem = lat >= 0 ? 'N' : 'S';

  const absLng = Math.abs(lng);
  const lngDeg = Math.floor(absLng);
  const lngMin = (absLng - lngDeg) * 60;
  const lngStr = String(lngDeg).padStart(3, '0') + lngMin.toFixed(4).padStart(7, '0');
  const lngHem = lng >= 0 ? 'E' : 'W';

  return { latStr, latHem, lngStr, lngHem };
}

function sendTcpPacket(packet) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(PORT, '127.0.0.1', () => {
      client.write(packet);
      setTimeout(() => {
        client.end();
        resolve();
      }, 150);
    });

    client.on('error', (err) => {
      console.error(`[SIMULATOR ERROR] TCP Socket connection failed on port ${PORT}: ${err.message}`);
      client.destroy();
      reject(err);
    });
  });
}

// Generates a path of coordinates circling Kigali City Center
function generateRoute() {
  const points = [];
  const centerLat = -1.944072;
  const centerLng = 30.061885;
  const numSteps = 40;
  
  for (let i = 0; i < numSteps; i++) {
    const angle = (i / numSteps) * 2 * Math.PI;
    const latOffset = 0.01 * Math.sin(angle);
    const lngOffset = 0.015 * Math.cos(angle);
    
    // Calculate heading (direction of movement) in degrees
    let heading = Math.round((angle * 180) / Math.PI + 90);
    if (heading < 0) heading += 360;
    if (heading >= 360) heading -= 360;

    points.push({
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      heading,
    });
  }
  return points;
}

async function startSimulation() {
  console.log('\n======================================================');
  console.log('       SinoTrack ST-901 Live Telemetry Simulator');
  console.log('======================================================');
  console.log(`Port:     ${PORT} (TCP Socket Ingestion)`);
  console.log(`Device:   IMEI ${TEST_IMEI}`);
  console.log('======================================================\n');

  try {
    // 1. Assert DB device is set up
    let device = await prisma.device.findUnique({
      where: { imei: TEST_IMEI },
    });

    if (device) {
      console.log(`[DB] Found active device ${device.deviceUid} with IMEI ${TEST_IMEI}.`);
    } else {
      device = await prisma.device.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!device) {
        console.error('FAIL: No active devices found in the database. Please seed E-Moto database first.');
        process.exit(1);
      }

      console.log(`[DB] Mapping active device ${device.deviceUid} to test IMEI ${TEST_IMEI}...`);
      await prisma.device.update({
        where: { id: device.id },
        data: { imei: TEST_IMEI },
      });
    }

    // Verify assigned bike
    const updatedDevice = await prisma.device.findUnique({
      where: { id: device.id },
      include: { bike: true },
    });

    if (updatedDevice.bikeId) {
      console.log(`[DB] Mapped to active Bike: "${updatedDevice.bike.label}" (ID: ${updatedDevice.bikeId})`);
    } else {
      const firstBike = await prisma.bike.findFirst({
        where: { status: 'ACTIVE' },
      });
      if (firstBike) {
        console.log(`[DB] Mapped device to unassigned active Bike: "${firstBike.label}"`);
        await prisma.device.update({
          where: { id: device.id },
          data: { bikeId: firstBike.id },
        });
      }
    }

    const route = generateRoute();
    console.log(`[SIMULATOR] Generated Kigali journey trajectory path (${route.length} route coordinates).`);
    console.log('[SIMULATOR] Launching GPRS stream loop. Open the Dashboard Live Map (/live) to watch the bike move!\n');

    let step = 0;
    while (true) {
      const coord = route[step % route.length];
      
      // Calculate speed (simulate accelerating, cruising, and braking)
      const phase = step % route.length;
      let speedKph = 25;
      if (phase < 5) speedKph = phase * 8; // accelerate
      else if (phase > route.length - 5) speedKph = (route.length - phase) * 8; // decelerate
      else speedKph = 40 + Math.random() * 8; // cruise

      const speedKnots = speedKph / 1.852;

      // Formatting SinoTrack packet variables
      const { latStr, latHem, lngStr, lngHem } = convertToSinoTrackCoords(coord.lat, coord.lng);
      
      const now = new Date();
      const timeStr = now.toISOString().replace(/[-T:]/g, '').slice(8, 14); // hhmmss
      const dateStr = now.toISOString().slice(8, 10) + now.toISOString().slice(5, 7) + now.toISOString().slice(2, 4); // ddmmyy
      const statusHex = 'FFFFFFFF'; // ACC/Ignition is ON (positive active-high bitwise 0x04)

      // Construct SinoTrack packet
      const packet = `*HQ,${TEST_IMEI},V1,${timeStr},A,${latStr},${latHem},${lngStr},${lngHem},${speedKnots.toFixed(1).padStart(5, '0')},${String(coord.heading).padStart(3, '0')},${dateStr},${statusHex}#`;

      console.log(`[Step ${step + 1}] Sending ST-901 Packet:`);
      console.log(`  - Coordinates: ${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`);
      console.log(`  - Heading:     ${coord.heading}°`);
      console.log(`  - Speed:       ${speedKph.toFixed(1)} km/h (${speedKnots.toFixed(1)} Knots)`);
      console.log(`  - Ignition:    ACC ON`);
      
      await sendTcpPacket(packet);

      step++;
      await sleep(SIMULATION_INTERVAL_MS);
    }
  } catch (err) {
    console.error(`[SIMULATOR FATAL] Error running loop: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle exit cleanly
process.on('SIGINT', async () => {
  console.log('\n[SIMULATOR] Exiting and disconnecting database connection safely...');
  await prisma.$disconnect();
  process.exit(0);
});

startSimulation();
