const fs = require('fs');
const path = require('path');

const targetDirs = [
  'f:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)',
  'f:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components'
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      content = content.replace(/text-white\/50/g, 'text-ink-muted');
      content = content.replace(/text-white\/60/g, 'text-ink-soft');
      content = content.replace(/text-white\/40/g, 'text-ink-faint');
      content = content.replace(/text-white\/90/g, 'text-ink');
      
      content = content.replace(/border-white\/10-strong/g, 'border-line-strong');
      content = content.replace(/border-white\/10(?!\S)/g, 'border-line');
      
      content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-surface-muted');
      content = content.replace(/bg-white\/\[0\.03\]/g, 'bg-surface-hover');
      content = content.replace(/bg-white\/\[0\.04\]/g, 'bg-surface-hover');
      content = content.replace(/border-white\/\[0\.05\]/g, 'border-line');
      
      content = content.replace(/bg-black\/80 backdrop-blur-\[60px\] shadow-\[-10px_0_40px_rgba\(0,0,0,0\.5\)\]/g, 'bg-background shadow-[var(--shadow-strong)]');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

targetDirs.forEach(processDir);
