const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/financial/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('startTs =');
  if (idx !== -1) {
    console.log(content.slice(idx, idx + 1000));
  }
}
