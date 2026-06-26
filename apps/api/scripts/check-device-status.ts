import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const deviceUid = '9171082746';
  console.log(`=== E-Moto Fleet OS Live Diagnosis for Device: ${deviceUid} ===\n`);

  // 1. Fetch Device details
  const device = await prisma.device.findFirst({
    where: {
      OR: [
        { deviceUid: deviceUid },
        { imei: deviceUid }
      ]
    },
    include: {
      bike: true
    }
  });

  if (!device) {
    console.error(`❌ ERROR: Device "${deviceUid}" does not exist in this database.`);
    
    // Suggest search for other similar device UIDs
    const similarDevices = await prisma.device.findMany({
      where: {
        deviceUid: { contains: '917' }
      },
      take: 5
    });
    if (similarDevices.length > 0) {
      console.log('\nDid you mean one of these registered devices?');
      similarDevices.forEach(d => console.log(`- UID: ${d.deviceUid} | IMEI: ${d.imei}`));
    }
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Device Found:`);
  console.log(`- Device Database ID: ${device.id}`);
  console.log(`- Device UID: ${device.deviceUid}`);
  console.log(`- Device IMEI: ${device.imei}`);
  console.log(`- Device Status: ${device.status}`);
  console.log(`- Device Fleet ID: ${device.fleetId}`);
  console.log(`- Last Seen Timestamp: ${device.lastSeenAt ? device.lastSeenAt.toISOString() : 'NEVER'}`);

  // 2. Check Bike Assignment
  console.log(`\n✅ Checking Bike Assignment:`);
  if (!device.bikeId) {
    console.log(`❌ WARNING: Device is NOT assigned to any bike. It will not show up on the Live Map.`);
  } else if (!device.bike) {
    console.log(`❌ ERROR: Device refers to bikeId "${device.bikeId}" but that bike does not exist in the database.`);
  } else {
    const bike = device.bike;
    console.log(`- Bound Bike Database ID: ${bike.id}`);
    console.log(`- Bound Bike Label: ${bike.label}`);
    console.log(`- Bound Bike Plate: ${bike.plate}`);
    console.log(`- Bound Bike Status: ${bike.status}`);
    console.log(`- Bound Bike Fleet ID: ${bike.fleetId}`);

    // Check Fleet Isolation Alignment
    if (device.fleetId !== bike.fleetId) {
      console.log(`❌ ERROR: Fleet ID Mismatch!`);
      console.log(`  - Device belongs to Fleet: "${device.fleetId}"`);
      console.log(`  - Bike belongs to Fleet:   "${bike.fleetId}"`);
      console.log(`  This mismatch causes telemetry updates to be cached in the wrong fleet segment, making it invisible to the operator.`);
    } else {
      console.log(`- Fleet IDs Match: Yes (Fleet ID: ${bike.fleetId})`);
    }
  }

  // 3. Fetch latest telemetry points
  console.log(`\n✅ Telemetry Audit:`);
  const points = await prisma.telemetryPoint.findMany({
    where: { deviceId: device.id },
    orderBy: { ts: 'desc' },
    take: 5
  });

  if (points.length === 0) {
    console.log('- No GPRS telemetry packets (A) have ever been saved in the DB for this device.');
  } else {
    console.log(`- Found ${points.length} saved telemetry coordinates in DB. Latest ones:`);
    points.forEach((p, idx) => {
      console.log(`  ${idx + 1}. Time: ${p.ts.toISOString()} | Lat: ${p.lat} | Lng: ${p.lng} | Speed: ${p.speedKph} kph`);
    });
  }

  // 4. Check Redis Live State Cache (Diagnostics suggestion)
  console.log(`\n💡 Note for GPRS connection:`);
  const timeDiffMinutes = device.lastSeenAt 
    ? (Date.now() - device.lastSeenAt.getTime()) / 60000 
    : Infinity;

  if (timeDiffMinutes > 5) {
    console.log(`⚠️ WARNING: The device was last seen ${timeDiffMinutes.toFixed(1)} minutes ago.`);
    console.log(`  Since the Railway redeployment restarted the GPRS server, the tracker might still be waiting to reconnect.`);
    console.log(`  Please trigger a manual GPRS reconnect by sending an SMS to the tracker (or restart the vehicle's ignition).`);
  } else {
    console.log(`⚡ Device is communicating actively! Last seen ${timeDiffMinutes.toFixed(2)} minutes ago.`);
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error running diagnosis:', err);
});
