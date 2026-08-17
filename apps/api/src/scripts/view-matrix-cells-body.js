const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/financial/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('matrixDays.map');
  let idx2 = content.indexOf('matrixDays.map', idx + 1);
  if (idx2 !== -1) {
    console.log(content.slice(idx2 - 100, idx2 + 1500));
  }
}
