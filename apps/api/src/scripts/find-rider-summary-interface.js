const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('interface RiderSummary') || lines[i].includes('type RiderSummary') || lines[i].includes('leaseDailyRate: true')) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
