const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkState() {
  console.log('--- DATABASE CHECK ---');
  try {
    const targetBikeId = '1813866a-e8f2-4889-8dab-39db11a1207e';
    const simulatedImei = '860953020000000';

    // 1. Find the simulated device
    const simDevice = await prisma.device.findUnique({
      where: { imei: simulatedImei },
      include: { bike: true }
    });
    console.log('\n[Simulated Device]');
    if (simDevice) {
      console.log(`- Device ID:   ${simDevice.id}`);
      console.log(`- Device UID:  ${simDevice.deviceUid}`);
      console.log(`- Status:      ${simDevice.status}`);
      console.log(`- Mapped Bike: ${simDevice.bikeId ? `"${simDevice.bike.label}" (ID: ${simDevice.bikeId})` : 'UNASSIGNED'}`);
    } else {
      console.log(`- FAIL: Device with IMEI ${simulatedImei} not found!`);
    }

    // 2. Find the bike the user is trying to lock
    const targetBike = await prisma.bike.findUnique({
      where: { id: targetBikeId },
    });
    console.log('\n[User Target Bike]');
    if (targetBike) {
      console.log(`- Bike ID:     ${targetBike.id}`);
      console.log(`- Label:       ${targetBike.label}`);
      console.log(`- Plate:       ${targetBike.plate}`);
      console.log(`- Status:      ${targetBike.status}`);
      
      // Find device mapped to this bike
      const targetDevice = await prisma.device.findFirst({
        where: { bikeId: targetBikeId, status: 'ACTIVE' }
      });
      if (targetDevice) {
        console.log(`- Active Device Mapped: ${targetDevice.deviceUid} (ID: ${targetDevice.id}, IMEI: ${targetDevice.imei})`);
        
        // Find latest telemetry points for this device
        const telemetry = await prisma.telemetryPoint.findMany({
          where: { deviceId: targetDevice.id },
          orderBy: { ts: 'desc' },
          take: 5
        });
        console.log(`- Recent Telemetry Points count: ${telemetry.length}`);
        telemetry.forEach((pt, i) => {
          console.log(`  [${i + 1}] ts: ${pt.ts.toISOString()}, speed: ${pt.speedKph} km/h, ignition: ${pt.ignition}`);
        });

        // Find last moving point
        const lastMoving = await prisma.telemetryPoint.findFirst({
          where: { deviceId: targetDevice.id, speedKph: { gt: 0.01 } },
          orderBy: { ts: 'desc' }
        });
        if (lastMoving) {
          console.log(`- Last Moving Point: ts: ${lastMoving.ts.toISOString()}, speed: ${lastMoving.speedKph} km/h`);
          console.log(`- Time since last moving: ${Math.round((Date.now() - lastMoving.ts.getTime()) / 1000)} seconds`);
        } else {
          console.log('- Last Moving Point: NONE (Bike was never moving)');
        }
      } else {
        console.log('- Mapped Device: NONE (No active device is currently assigned to this bike!)');
      }
    } else {
      console.log(`- FAIL: Bike with ID ${targetBikeId} not found!`);
    }

  } catch (err) {
    console.error('Error during check:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkState();
