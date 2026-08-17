const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.types.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('RiderSummary');
  if (idx !== -1) {
    console.log(content.slice(idx - 50, idx + 400));
  }
}
