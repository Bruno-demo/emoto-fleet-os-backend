const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('leasePrincipal') || lines[i].includes('leaseDailyRate') || lines[i].includes('leaseToOwn')) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
