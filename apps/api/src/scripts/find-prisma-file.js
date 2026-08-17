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
    } else if (f === 'schema.prisma') {
      console.log('FOUND SCHEMA AT:', full);
    }
  }
}

search('F:/emoto-fleet-os/emoto-fleet-os-backend');
