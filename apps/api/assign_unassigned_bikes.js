const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SCANNING AND ASSIGNING UNASSIGNED BIKES IN PERSONAL FLEETS ---');
  try {
    // 1. Fetch all personal fleets
    const personalFleets = await prisma.fleet.findMany({
      where: { type: 'PERSONAL' },
      include: {
        users: { where: { role: 'RIDER' } },
        bikes: {
          include: {
            assignments: { where: { active: true } }
          }
        }
      }
    });

    console.log(`Found ${personalFleets.length} PERSONAL fleets in total.`);

    let assignmentsCreated = 0;

    for (const fleet of personalFleets) {
      console.log(`\nFleet: "${fleet.name}" (ID: ${fleet.id})`);
      const rider = fleet.users[0]; // PERSONAL fleets typically have one rider

      if (!rider) {
        console.log(`- Warning: No RIDER user found in this fleet! Skipping.`);
        continue;
      }

      console.log(`- Fleet Rider: ${rider.email || rider.phone} (ID: ${rider.id})`);

      for (const bike of fleet.bikes) {
        const activeAssignment = bike.assignments[0];
        if (activeAssignment) {
          console.log(`- Bike "${bike.label}" (ID: ${bike.id}) already has active assignment to Rider ID: ${activeAssignment.riderUserId}`);
        } else {
          console.log(`- Bike "${bike.label}" (ID: ${bike.id}) is UNASSIGNED! Creating active assignment...`);
          
          await prisma.$transaction(async (tx) => {
            // Deactivate any existing active assignments for this rider in this fleet
            await tx.bikeAssignment.updateMany({
              where: { fleetId: fleet.id, riderUserId: rider.id, active: true },
              data: { active: false, unassignedAt: new Date() }
            });

            // Create new active assignment
            const newAssignment = await tx.bikeAssignment.create({
              data: {
                fleetId: fleet.id,
                bikeId: bike.id,
                riderUserId: rider.id,
                active: true
              }
            });
            console.log(`  + Created BikeAssignment ID: ${newAssignment.id}`);
          });

          assignmentsCreated++;
        }
      }
    }

    console.log(`\nScan complete. Created ${assignmentsCreated} new active assignments.`);
  } catch (err) {
    console.error('Error executing auto-assignment:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
