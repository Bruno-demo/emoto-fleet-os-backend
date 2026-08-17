const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('createRider(');
  if (idx !== -1) {
    console.log(content.slice(idx, idx + 1500));
  }
}
