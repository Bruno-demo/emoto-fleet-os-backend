const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lastIdx = 0;
  while (true) {
    let idx = content.indexOf('Password', lastIdx + 1);
    if (idx === -1) break;
    console.log(`\n--- Match at ${idx} ---`);
    console.log(content.slice(idx - 100, idx + 300));
    lastIdx = idx;
  }
}
