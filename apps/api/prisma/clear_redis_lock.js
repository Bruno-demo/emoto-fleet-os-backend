const Redis = require('ioredis');

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  try {
    const keys = await redis.keys('login_attempts:*');
    console.log('Found login attempt lockout keys:', keys);

    for (const key of keys) {
      await redis.del(key);
      console.log(`Successfully deleted Redis lockout key: ${key}`);
    }

    console.log('--- ALL LOGIN LOCKOUTS CLEARED ---');
  } catch (err) {
    console.error('Error clearing Redis lockout keys:', err);
  } finally {
    redis.disconnect();
  }
}

main();
