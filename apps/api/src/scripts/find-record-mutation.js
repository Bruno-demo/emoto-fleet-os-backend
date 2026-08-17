const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/billing/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const idx = content.indexOf('recordPaymentMutation');
if (idx !== -1) {
  console.log(content.slice(idx, idx + 600));
} else {
  console.log('recordPaymentMutation not found');
}
