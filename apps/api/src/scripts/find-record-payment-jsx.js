const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/billing/page.tsx';
const content = fs.readFileSync(path, 'utf8');

let lastIdx = 0;
while (true) {
  const idx = content.indexOf('showRecordPayment', lastIdx + 1);
  if (idx === -1) break;
  console.log(`\n--- Match at ${idx} ---`);
  console.log(content.slice(idx - 100, idx + 400));
  lastIdx = idx;
}
