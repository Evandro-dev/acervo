import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ensureArea } from "../src/modules/areas/areas.service.js";
import { ensureCourses } from "../src/modules/courses/courses.service.js";
import { institutionalAreas, institutionalCourses } from "./institutional-catalog-data.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está definida.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const CATALOG_SYNC_TRANSACTION_TIMEOUT_MS = 30_000;

async function main() {
  await prisma.$transaction(
    async (transaction) => {
      for (const area of institutionalAreas) {
        await ensureArea(transaction, area);
      }

      await ensureCourses(transaction, [...institutionalCourses]);
    },
    { timeout: CATALOG_SYNC_TRANSACTION_TIMEOUT_MS },
  );

  console.log(`Catálogo institucional sincronizado: ${institutionalAreas.length} áreas e ${institutionalCourses.length} cursos.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
