const Redis = require('ioredis');

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
    const pattern = 'live:fleet:*:bike:*';
    const keys = await client.keys(pattern);
    
    console.log(`Found ${keys.length} cached live bike state(s) in Redis.`);
    
    if (keys.length > 0) {
      for (const key of keys) {
        await client.del(key);
        console.log(`- Deleted cache key: ${key}`);
      }
      console.log('Redis cache cleared successfully.');
    } else {
      console.log('No live bike states found in Redis cache to delete.');
    }
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
  } finally {
    client.disconnect();
  }
}

run();
