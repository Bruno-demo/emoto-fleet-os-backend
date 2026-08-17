const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('Operational Tracker');
  if (idx === -1) idx = content.indexOf('Interactive payment matrix');
  if (idx !== -1) {
    console.log('--- OPERATIONAL TRACKER MATCH ---');
    console.log(content.slice(idx - 100, idx + 800));
  }
}
