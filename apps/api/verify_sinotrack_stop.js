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
  console.log('  SinoTrack ST-901 Deceleration & Lock Prep Simulator');
  console.log('======================================================');
  console.log(`Port:     ${PORT} (TCP Socket Ingestion)`);
  console.log(`Device:   IMEI ${TEST_IMEI}`);
  console.log('======================================================\n');

  try {
    // 1. Assert DB device is set up
    let device = await prisma.device.findUnique({
      where: { imei: TEST_IMEI },
    });

    if (!device) {
      console.error('FAIL: Test IMEI 860953020000000 not found in database.');
      process.exit(1);
    }

    const updatedDevice = await prisma.device.findUnique({
      where: { id: device.id },
      include: { bike: true },
    });

    if (updatedDevice.bikeId) {
      console.log(`[DB] Mapped to active Bike: "${updatedDevice.bike.label}"`);
    }

    const route = generateRoute();
    console.log(`[SIMULATOR] Decelerating bike journey to Kigali City Center...`);

    // Let's start from a cruising position (e.g. index 10)
    let step = 0;
    let currentSpeedKph = 45.0;
    const stopPoint = route[15]; // Fix at this coordinate once stopped

    while (true) {
      let coord;
      let isStopped = false;

      if (currentSpeedKph > 0) {
        // Still moving/decelerating along the route
        coord = route[(10 + step) % route.length];
        // Decelerate by 10 km/h per step
        currentSpeedKph = Math.max(0, currentSpeedKph - 9.0);
      } else {
        // Fully stopped! Anchor at the Kigali City Center stop point
        coord = stopPoint;
        currentSpeedKph = 0.0;
        isStopped = true;
      }

      const speedKnots = currentSpeedKph / 1.852;
      const { latStr, latHem, lngStr, lngHem } = convertToSinoTrackCoords(coord.lat, coord.lng);
      
      const now = new Date();
      const timeStr = now.toISOString().replace(/[-T:]/g, '').slice(8, 14); // hhmmss
      const dateStr = now.toISOString().slice(8, 10) + now.toISOString().slice(5, 7) + now.toISOString().slice(2, 4); // ddmmyy
      const statusHex = 'FFFFFBFF'; // ACC/Ignition is ON (negative active-low bitwise 0x04)

      const packet = `*HQ,${TEST_IMEI},V1,timeStr,A,${latStr},${latHem},${lngStr},${lngHem},${speedKnots.toFixed(1).padStart(5, '0')},${String(coord.heading).padStart(3, '0')},${dateStr},${statusHex}#`
        .replace('timeStr', timeStr); // Safe inject

      console.log(`[Step ${step + 1}] Sending ST-901 Packet:`);
      console.log(`  - Coordinates: ${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`);
      console.log(`  - Speed:       ${currentSpeedKph.toFixed(1)} km/h (${speedKnots.toFixed(1)} Knots)`);
      
      if (isStopped) {
        const stationarySeconds = step * 3;
        console.log(`  - Status:      ⛔ STOPPED (Stationary for ${stationarySeconds}s)`);
        if (stationarySeconds >= 15) {
          console.log(`  - 🛡️ LOCK SAFETY: READY (Safe to dispatch LOCK command!)`);
        } else {
          console.log(`  - 🛡️ LOCK SAFETY: WAITING (${15 - stationarySeconds}s remaining until safe-lock window opens)`);
        }
      } else {
        console.log(`  - Status:      📉 DECELERATING`);
      }
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
