const Redis = require('ioredis');

// Simple script to print raw GPRS packets cached in Redis
async function run() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('ERROR: REDIS_URL environment variable is not defined.');
    process.exit(1);
  }

  const maskedUrl = redisUrl.includes('@') ? redisUrl.replace(/\/\/.*@/, '//****@') : redisUrl;
  console.log('Connecting to Redis at:', maskedUrl);
  const client = new Redis(redisUrl);

  try {
    const listKey = 'sinotrack:raw_packets';
    console.log(`Fetching latest raw GPRS packets from list: "${listKey}"...\n`);

    const rawLogs = await client.lrange(listKey, 0, -1);
    if (rawLogs.length === 0) {
      console.log('No raw packets logged yet. Make sure the SinoTrack device is connected and sending GPRS data.');
      client.disconnect();
      return;
    }

    console.log(`Found ${rawLogs.length} logged packets (showing newest first):\n`);
    
    rawLogs.forEach((logStr, idx) => {
      try {
        const log = JSON.parse(logStr);
        console.log(`[${idx + 1}] Time: ${log.ts} | Remote: ${log.remoteAddress}`);
        console.log(`    Raw Packet: ${log.packet}`);
        
        // Basic parser preview
        const content = log.packet.trim();
        if (content.startsWith('*HQ')) {
          const body = content.endsWith('#') ? content.slice(0, -1) : content;
          const parts = body.split(',');
          console.log(`    -> Parsed IMEI:     ${parts[1]}`);
          console.log(`    -> Parsed Command:  ${parts[2]}`);
          if (parts[2] === 'V1') {
            console.log(`    -> Validity Flag:   "${parts[4]}" (A = Active GPS, V = Void/No GPS)`);
            console.log(`    -> Lat/Lng parts:   ${parts[5] || 'none'} ${parts[6] || ''} | ${parts[7] || 'none'} ${parts[8] || ''}`);
            console.log(`    -> Date/Time:       ${parts[11] || 'none'} / ${parts[3] || 'none'}`);
            console.log(`    -> Parts Count:     ${parts.length} (Expected >= 13 for DB save)`);
          }
        } else {
          console.log(`    -> ⚠️ Invalid SinoTrack *HQ header`);
        }
        console.log('-'.repeat(60));
      } catch (err) {
        console.log(`[${idx + 1}] Error parsing log entry:`, err.message);
        console.log(`    Raw entry: ${logStr}`);
      }
    });

  } catch (error) {
    console.error('Error reading raw packets:', error);
  } finally {
    client.disconnect();
  }
}

run();
