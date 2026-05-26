import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const backendEnvPath = path.join(backendDir, ".env");
const npmCommand = "npm";

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function readBackendPort() {
  if (!(await pathExists(backendEnvPath))) {
    return 3333;
  }

  const content = await readFile(backendEnvPath, "utf8");
  const match = content.match(/^\s*PORT\s*=\s*"?(\d+)"?\s*$/m);
  return match ? Number(match[1]) : 3333;
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function detectBackendState(port) {
  const portOpen = await isPortOpen(port);
  if (!portOpen) return "stopped";

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const data = await response.json();
    if (response.ok && data?.ok === true && data?.service === "acervo-api") {
      return "acervo";
    }
  } catch {
    // no-op
  }

  return "foreign";
}

function run(command, args, cwd = rootDir) {
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

function spawnLongRunning(command, args, cwd = rootDir) {
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

  return spawn(childProcess.command, childProcess.args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
}

async function ensureBackendDependencies() {
  const requiredPaths = [
    path.join(backendDir, "node_modules", "pg", "package.json"),
    path.join(backendDir, "node_modules", "@prisma", "client", "package.json"),
  ];

  const missingDependency = await Promise.all(requiredPaths.map((target) => pathExists(target))).then((checks) => checks.some((exists) => !exists));
  if (!missingDependency) return;

  console.log("[acervo] instalando dependências do backend...");
  await run(npmCommand, ["install"], backendDir);
}

async function ensureFrontendDependencies() {
  const requiredPaths = [
    path.join(frontendDir, "node_modules", "vite", "package.json"),
    path.join(frontendDir, "node_modules", "react", "package.json"),
  ];

  const missingDependency = await Promise.all(requiredPaths.map((target) => pathExists(target))).then((checks) => checks.some((exists) => !exists));
  if (!missingDependency) return;

  console.log("[acervo] instalando dependências do frontend...");
  await run(npmCommand, ["install"], frontendDir);
}

async function main() {
  const backendPort = await readBackendPort();
  const backendState = await detectBackendState(backendPort);

  if (backendState === "foreign") {
    throw new Error(`[acervo] a porta ${backendPort} já está ocupada por outro processo que não é a API do projeto.`);
  }

  let backendProcess = null;

  if (backendState === "acervo") {
    console.log(`[acervo] backend já está rodando na porta ${backendPort}; reutilizando processo existente.`);
  } else {
    await ensureBackendDependencies();
    await run(npmCommand, ["run", "bootstrap:dev", "--prefix", "backend"]);
    backendProcess = spawnLongRunning(npmCommand, ["run", "dev", "--prefix", "backend"]);
  }

  await ensureFrontendDependencies();
  const frontendProcess = spawnLongRunning(npmCommand, ["run", "dev", "--prefix", "frontend"]);

  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (backendProcess) {
      backendProcess.kill(signal);
    }
    frontendProcess.kill(signal);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (backendProcess) {
    backendProcess.on("exit", (code) => {
      if (!shuttingDown) {
        shuttingDown = true;
        frontendProcess.kill("SIGTERM");
        process.exit(code ?? 1);
      }
    });
  }

  frontendProcess.on("exit", (code) => {
    if (!shuttingDown) {
      shuttingDown = true;
      if (backendProcess) {
        backendProcess.kill("SIGTERM");
      }
      process.exit(code ?? 1);
    }
  });
}

main().catch((error) => {
  console.error("[acervo] falha ao iniciar ambiente de desenvolvimento");
  console.error(error);
  process.exit(1);
});
