const fs = require('fs');

function findSeed() {
  const paths = [
    'F:/emoto-fleet-os/emoto-fleet-os-backend/prisma/seed.js',
    'F:/emoto-fleet-os/emoto-fleet-os-backend/prisma/seed.ts',
    'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/prisma/seed.js',
    'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/prisma/seed.ts',
    'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/scripts/simulate-fleet.ts',
    'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/scripts/publish-sample-telemetry.ts'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log('FOUND seed file at:', p);
    }
  }
}

findSeed();
