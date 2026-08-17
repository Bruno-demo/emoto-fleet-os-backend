const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/prisma/schema.prisma';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('model ') && (lines[i].includes('Pay') || lines[i].includes('Lease') || lines[i].includes('Collect'))) {
      console.log(`Line ${i + 1}: ${lines[i]}`);
    }
  }
}
