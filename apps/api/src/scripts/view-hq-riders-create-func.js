const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(hq)/hq/riders/page.tsx';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8').split('\n');
  for (let i = 0; i < content.length; i++) {
    if (content[i].includes('Password must be at least 8 characters') || content[i].includes('isDirectFormInvalid')) {
      console.log(`Line ${i + 1}: ${content[i]}`);
    }
  }
}
