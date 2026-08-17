const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/billing/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('fleet-cycles') || line.includes('/billing/cycles')) {
    console.log(`Line ${i+1}: ${line}`);
  }
});
