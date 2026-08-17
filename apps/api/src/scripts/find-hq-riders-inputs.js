const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let idx = content.indexOf('Password');
  if (idx !== -1) {
    console.log('--- HQ RIDERS PASSWORD MATCH ---');
    console.log(content.slice(idx - 100, idx + 400));
  } else {
    console.log('No Password field found in hq/riders/page.tsx');
  }
}
