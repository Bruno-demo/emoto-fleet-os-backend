const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/billing/page.tsx';
const content = fs.readFileSync(path, 'utf8');

let lastIdx = 0;
while (true) {
  let idx = content.indexOf('Oct 11', lastIdx + 1);
  if (idx === -1) break;
  console.log(`\n--- Match at ${idx} ---`);
  console.log(content.slice(idx - 200, idx + 400));
  lastIdx = idx;
}

let lastIdx2 = 0;
while (true) {
  let idx = content.indexOf('Kigali fleet', lastIdx2 + 1);
  if (idx === -1) break;
  console.log(`\n--- Kigali Fleet Match at ${idx} ---`);
  console.log(content.slice(idx - 200, idx + 400));
  lastIdx2 = idx;
}
