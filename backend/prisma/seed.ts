import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedUsers } from "./seed-data.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("acervo123", 10);

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
