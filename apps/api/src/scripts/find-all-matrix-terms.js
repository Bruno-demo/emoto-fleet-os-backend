const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('matrix') || lines[i].includes('tracker') || lines[i].includes('paymentSchedule') || lines[i].includes('customScheduleDays')) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
