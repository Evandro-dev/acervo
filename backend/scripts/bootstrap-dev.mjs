import { spawn } from "node:child_process";
import { access, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const envPath = path.join(backendDir, ".env");
const envExamplePath = path.join(backendDir, ".env.example");
const prismaEnginePath = path.join(backendDir, "node_modules", ".prisma", "client", "query_engine-windows.dll.node");
const npmCommand = "npm";

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, cwd = backendDir) {
  const childProcess =
    process.platform === "win32"
      ? {
          command: process.env.ComSpec || "cmd.exe",
          args: ["/d", "/s", "/c", command, ...args],
        }
      : {
          command,
          args,
        };

  return new Promise((resolve, reject) => {
    const child = spawn(childProcess.command, childProcess.args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

function runCaptured(command, args, cwd = backendDir) {
  const childProcess =
    process.platform === "win32"
      ? {
          command: process.env.ComSpec || "cmd.exe",
          args: ["/d", "/s", "/c", command, ...args],
        }
      : {
          command,
          args,
        };

  return new Promise((resolve, reject) => {
    const child = spawn(childProcess.command, childProcess.args, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      shell: false,
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      const error = new Error(`Command failed: ${command} ${args.join(" ")}`);
      error.output = output;
      reject(error);
    });
  });
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function ensureEnvFile() {
  if (await pathExists(envPath)) return;
  await copyFile(envExamplePath, envPath);
  console.log("[acervo] backend/.env criado a partir de .env.example");
}

async function ensureDatabaseExists(databaseUrl) {
  const targetUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(targetUrl.pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL sem nome de banco.");
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rowCount) {
      console.log(`[acervo] banco ${databaseName} já existe`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`[acervo] banco ${databaseName} criado`);
  } finally {
    await client.end();
  }
}

async function seedIfEmpty(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tableCheck = await client.query("SELECT to_regclass('public.users') AS table_name");
    if (!tableCheck.rows[0]?.table_name) return;

    const countResult = await client.query("SELECT COUNT(*)::int AS count FROM users");
    const userCount = countResult.rows[0]?.count ?? 0;

    if (userCount > 0) {
      console.log("[acervo] seed ignorado porque já existem usuários");
      return;
    }
  } finally {
    await client.end();
  }

  console.log("[acervo] banco vazio detectado, executando seed inicial");
  await run(npmCommand, ["run", "seed"]);
}

async function syncPrismaClient() {
  console.log("[acervo] sincronizando cliente Prisma");

  try {
    await runCaptured(npmCommand, ["run", "prisma:generate"]);
    return;
  } catch (error) {
    const output = error instanceof Error && "output" in error ? String(error.output ?? "") : "";
    const lockedWindowsEngine =
      process.platform === "win32" &&
      /EPERM: operation not permitted, rename .*query_engine-windows\.dll\.node\.tmp/i.test(output);

    if (lockedWindowsEngine && (await pathExists(prismaEnginePath))) {
      console.warn("[acervo] cliente Prisma travado por outro processo no Windows; reutilizando client já gerado.");
      console.warn("[acervo] se você alterou o schema ou quiser reiniciar tudo, feche o backend antigo e rode npm run dev novamente.");
      return;
    }

    throw error;
  }
}

async function main() {
  await ensureEnvFile();
  dotenv.config({ path: envPath });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada.");
  }

  await ensureDatabaseExists(databaseUrl);
  await syncPrismaClient();
  await run(npmCommand, ["run", "prisma:deploy"]);
  await seedIfEmpty(databaseUrl);
}

main().catch((error) => {
  console.error("[acervo] falha no bootstrap do backend");
  console.error(error);
  process.exit(1);
});
