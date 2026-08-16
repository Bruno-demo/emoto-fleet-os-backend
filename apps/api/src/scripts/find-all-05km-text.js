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
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      if (
        content.includes('0.5 km') ||
        content.includes('0.5km') ||
        content.includes('Trip-Validated') ||
        content.includes('trips > 0.5')
      ) {
        console.log('FOUND match in:', full);
      }
    }
  }
}

console.log('Verifying monorepo for legacy text...');
search('F:/emoto-fleet-os/emoto-fleet-os-backend/apps');
console.log('Search finished.');
