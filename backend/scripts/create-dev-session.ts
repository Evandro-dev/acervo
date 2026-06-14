import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

if (!connectionString) throw new Error("DATABASE_URL não está definida.");
if (!JWT_SECRET) throw new Error("JWT_SECRET não está definida.");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.DEV_ADMIN_EMAIL ?? "dev-admin@example.com";
  const password = process.env.DEV_ADMIN_PASSWORD ?? "devpass";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Dev Admin",
      passwordHash,
      role: "ADMIN",
      jobTitle: "Dev",
      area: "Dev",
      bio: "Conta de teste para desenvolvimento",
    },
    create: {
      name: "Dev Admin",
      email,
      passwordHash,
      role: "ADMIN",
      jobTitle: "Dev",
      area: "Dev",
      bio: "Conta de teste para desenvolvimento",
    },
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const authSession = await prisma.authSession.create({
    data: {
      userId: user.id,
      expiresAt,
      ipHash: null,
      userAgent: "dev-script",
    },
  });

  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: user.id, sid: authSession.id, role: user.role, name: user.name };

  function base64url(input: Buffer | string) {
    const b = typeof input === "string" ? Buffer.from(input) : input;
    return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  const header64 = base64url(JSON.stringify(header));
  const payload64 = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header64}.${payload64}`)
    .digest();
  const signature64 = base64url(signature);

  const token = `${header64}.${payload64}.${signature64}`;

  console.log("DEV_JWT=", token);
  console.log("DEV_USER_ID=", user.id);
  console.log("DEV_SESSION_ID=", authSession.id);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
