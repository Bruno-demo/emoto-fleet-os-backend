const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/lib/types/dashboard.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('leasePrincipal');
  if (idx !== -1) {
    console.log(content.slice(idx - 100, idx + 200));
  }
}
