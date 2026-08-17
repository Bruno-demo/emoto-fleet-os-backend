const fs = require('fs');

const path1 = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/hq/hq.service.ts';
const content1 = fs.readFileSync(path1, 'utf8');

let idx1 = content1.indexOf('getBillingCycles');
if (idx1 !== -1) {
  console.log('--- HQ SERVICE getBillingCycles ---');
  console.log(content1.slice(idx1, idx1 + 600));
}

const path2 = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/billing/services/billing-cycle.service.ts';
const content2 = fs.readFileSync(path2, 'utf8');

let idx2 = content2.indexOf('findMany');
if (idx2 !== -1) {
  console.log('\n--- BILLING CYCLE SERVICE ---');
  console.log(content2.slice(idx2, idx2 + 400));
}
