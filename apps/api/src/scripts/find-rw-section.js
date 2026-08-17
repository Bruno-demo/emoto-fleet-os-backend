const fs = require('fs');

const content = fs.readFileSync('F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/lib/i18n/dictionaries.ts', 'utf8');
const rwIndex = content.indexOf('rw: {');
console.log('rw index:', rwIndex);
if (rwIndex !== -1) {
  const lineNum = content.slice(0, rwIndex).split('\n').length;
  console.log('rw starts around line:', lineNum);
}
