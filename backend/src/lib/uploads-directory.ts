import path from "node:path";

export function resolveUploadsDirectory(configuredDirectory?: string, cwd = process.cwd()) {
  return path.resolve(cwd, configuredDirectory?.trim() || "uploads");
}
