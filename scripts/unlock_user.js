const { Redis } = require('ioredis');
const redis = new Redis('redis://localhost:6379');

async function unlock() {
  const phone = '+254700000000';
  const key = `login_attempts:${phone}`;
  await redis.del(key);
  console.log(`Deleted key: ${key}`);
  await redis.quit();
}
unlock();
