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
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js') || f.endsWith('.json')) {
      const content = fs.readFileSync(full, 'utf8');
      if (
        content.includes('Exempt Idle Days') ||
        content.includes('Active Bike-Days') ||
        content.includes('Calculated PAYG Total') ||
        content.includes('Trip-Validated Daily Usage') ||
        content.includes('PAYG Validated')
      ) {
        console.log('FOUND match in:', full);
      }
    }
  }
}

console.log('Searching dashboard for audit modal text...');
search('F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard');
console.log('Search completed.');
