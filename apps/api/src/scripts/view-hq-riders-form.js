const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx1 = content.indexOf('Password');
  let idx2 = content.indexOf('Password', idx1 + 1);
  if (idx2 !== -1) {
    console.log('--- HQ RIDERS FORM ---');
    console.log(content.slice(idx2 - 200, idx2 + 400));
  }
}
