const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/packages/database/prisma/schema.prisma';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('model RiderProfile');
  if (idx !== -1) {
    console.log(content.slice(idx, idx + 800));
  }
}
