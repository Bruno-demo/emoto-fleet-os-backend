const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/hq/hq.service.ts';
const content = fs.readFileSync(path, 'utf8');

const idx = content.indexOf('getBillingFleets');
if (idx !== -1) {
  console.log(content.slice(idx, idx + 1800));
}
