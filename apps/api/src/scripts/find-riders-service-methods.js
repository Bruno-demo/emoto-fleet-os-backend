const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('create') || lines[i].includes('update') || lines[i].includes('lease')) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
