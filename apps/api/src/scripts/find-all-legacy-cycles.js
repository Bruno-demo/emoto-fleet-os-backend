const fs = require('fs');
const path = require('path');

function search(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('.next') && !full.includes('dist')) {
        search(full);
      }
    } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('Jul 28') || content.includes('Sep 11') || content.includes('Oct 11') || content.includes('Jul 13')) {
        console.log('FOUND match in:', full);
      }
    }
  }
}

search('F:/emoto-fleet-os/emoto-fleet-os-backend/apps');
