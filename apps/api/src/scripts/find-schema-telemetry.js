const fs = require('fs');

const schema = fs.readFileSync('F:/emoto-fleet-os/emoto-fleet-os-backend/prisma/schema.prisma', 'utf8');
const tpIdx = schema.indexOf('model TelemetryPoint');
if (tpIdx !== -1) {
  console.log(schema.slice(tpIdx, tpIdx + 800));
} else {
  console.log('TelemetryPoint model not found');
}
