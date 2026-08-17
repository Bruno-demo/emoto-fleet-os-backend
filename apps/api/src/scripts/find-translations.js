const fs = require('fs');
const path = require('path');

function search(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('.next')) {
        search(full);
      }
    } else if (f.includes('i18n') || f.includes('translation') || f.includes('locales')) {
      console.log('FOUND translation file:', full);
    }
  }
}

search('F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard');
