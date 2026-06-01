import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPrismaDeployWithRetry } from "./prisma-deploy-retry.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");

function runCaptured(command, args) {
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
      cwd: backendDir,
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
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const error = new Error(`Command failed: ${command} ${args.join(" ")}`);
      error.output = output;
      reject(error);
    });
  });
}

runPrismaDeployWithRetry(() => runCaptured("npm", ["run", "prisma:deploy"])).catch((error) => {
  console.error("[acervo] não foi possível aplicar as migrations do Prisma.");
  console.error(error);
  process.exit(1);
});
