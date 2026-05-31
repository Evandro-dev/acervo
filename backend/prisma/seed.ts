import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { requireSeedAccessPassword } from "../src/lib/seed-access-password.js";
import { seedUsers } from "./seed-data.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const seedAccessPassword = requireSeedAccessPassword(process.env.SEED_ACCESS_PASSWORD);
  const passwordHash = await bcrypt.hash(seedAccessPassword, 10);

  for (const userSeed of seedUsers) {
    await prisma.user.upsert({
      where: { email: userSeed.email },
      update: {
        name: userSeed.name,
        passwordHash,
        role: userSeed.role,
        jobTitle: userSeed.jobTitle,
        area: userSeed.area,
        bio: userSeed.bio,
      },
      create: {
        name: userSeed.name,
        email: userSeed.email,
        passwordHash,
        role: userSeed.role,
        jobTitle: userSeed.jobTitle,
        area: userSeed.area,
        bio: userSeed.bio,
      },
    });
  }

  console.log(`Seed concluído: ${seedUsers.length} usuários de acesso prontos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
