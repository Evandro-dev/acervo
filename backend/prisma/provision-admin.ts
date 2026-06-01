import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { requireAdminBootstrapPassword } from "../src/lib/initial-access-password.js";

const ADMIN_EMAIL = "unapousoalegre.oficial@gmail.com";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const password = requireAdminBootstrapPassword(process.env.ADMIN_BOOTSTRAP_PASSWORD);
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Administração UNA Pouso Alegre",
      passwordHash,
      role: "ADMIN",
      jobTitle: "Administração do ACERVO",
      area: "Gestão institucional",
      bio: "Conta administrativa inicial da UNA Pouso Alegre.",
    },
    create: {
      name: "Administração UNA Pouso Alegre",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      jobTitle: "Administração do ACERVO",
      area: "Gestão institucional",
      bio: "Conta administrativa inicial da UNA Pouso Alegre.",
    },
    select: { id: true, email: true },
  });

  await prisma.authSession.updateMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      revocationReason: "admin_reprovisioned",
    },
  });

  console.log(`Administrador inicial provisionado: ${user.email}`);
  console.log("Sessões anteriores da conta foram encerradas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
