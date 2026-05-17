const Redis = require('ioredis');

async function main() {
  const redis = new Redis('redis://localhost:6379');
  
  const bikeId = '00000000-0000-0000-0000-000000000411';
  const actualFleetId = '00000000-0000-0000-0000-000000000004';
  const stateKey = `live:fleet:${actualFleetId}:bike:${bikeId}`;

  console.log('Starting demo telemetry loop (updates every 10s)...');

  const update = async () => {
    const state = {
      ts: new Date(Date.now() - 25000).toISOString(), // Always 25s ago
      speedKph: 0,
      lat: -1.9441,
      lng: 30.0619,
      heading: 0,
      odometerKm: 123.4,
      soc: 85,
      isCharging: false,
      isLocked: false,
    };
    await redis.set(stateKey, JSON.stringify(state), 'EX', 60);
    console.log(`Updated telemetry for ${bikeId} at ${new Date().toISOString()}`);
  };

  await update();
  setInterval(update, 10000);
}

main();
