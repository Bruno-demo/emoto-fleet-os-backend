const fs = require('fs');

const path = 'F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/dto/create-rider.dto.ts';
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  console.log(content);
}
