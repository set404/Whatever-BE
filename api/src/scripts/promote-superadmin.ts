// One-time bootstrap: `npm run seed:superadmin`. Promotes BOOTSTRAP_SUPERADMIN_EMAIL
// (.env) to superadmin. The user must already exist — sign up through the app first.
// There's no in-app way to create the first superadmin, by design: role changes
// normally require an existing superadmin (see UsersController), so this script is
// the one deliberate bypass, meant to be run manually/locally, not exposed as an API.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
  if (!email) {
    console.error('Set BOOTSTRAP_SUPERADMIN_EMAIL in .env first.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Set DATABASE_URL in .env first.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const authUser = await prisma.authUser.findFirst({ where: { email } });
    if (!authUser) {
      console.error(
        `No signed-up user found with email ${email}. Sign up through the app first.`,
      );
      process.exit(1);
    }

    const profile = await prisma.profile.update({
      where: { id: authUser.id },
      data: { globalRole: 'superadmin' },
    });

    console.log(`Promoted ${email} (${profile.id}) to superadmin.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
