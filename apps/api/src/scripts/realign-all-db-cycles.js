const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDITING AND REALIGNING ALL BILLING CYCLES IN PRODUCTION DB ---');

  const cycles = await prisma.billingCycle.findMany({
    include: { fleet: true },
    orderBy: { periodStart: 'asc' },
  });

  console.log(`Total BillingCycle records in DB: ${cycles.length}`);

  for (const c of cycles) {
    const start = new Date(c.periodStart);
    const end = new Date(c.periodEnd);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`[BEFORE] Fleet: ${c.fleet.name} | Cycle #${c.cycleNumber} | Start: ${start.toISOString().slice(0, 10)} | End: ${end.toISOString().slice(0, 10)} (${diffDays} days)`);

    // Force periodEnd to be exactly 7 days after periodStart
    const newEnd = new Date(start);
    newEnd.setDate(newEnd.getDate() + 7);

    // Force dueDate to be newEnd
    const newDue = new Date(newEnd);

    await prisma.billingCycle.update({
      where: { id: c.id },
      data: {
        periodEnd: newEnd,
        dueDate: newDue,
      },
    });

    console.log(`  -> [AFTER] Start: ${start.toISOString().slice(0, 10)} | End: ${newEnd.toISOString().slice(0, 10)} | Due: ${newDue.toISOString().slice(0, 10)} (7 days)`);
  }

  console.log('\n--- ALL DB BILLING CYCLES REALIGNED TO 7-DAY WEEKLY WINDOWS ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
