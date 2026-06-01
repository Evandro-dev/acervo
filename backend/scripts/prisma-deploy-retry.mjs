const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000];

function getErrorOutput(error) {
  if (!error || typeof error !== "object") return "";
  return `${"message" in error ? error.message : ""}\n${"output" in error ? error.output : ""}`;
}

export function isPrismaAdvisoryLockTimeout(error) {
  const output = getErrorOutput(error);
  return /P1002/i.test(output) && /advisory lock/i.test(output);
}

export async function runPrismaDeployWithRetry(
  deploy,
  {
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    warn = console.warn,
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await deploy();
    } catch (error) {
      const retryDelayMs = retryDelaysMs[attempt];
      if (!isPrismaAdvisoryLockTimeout(error) || retryDelayMs === undefined) {
        throw error;
      }

      warn(
        `[acervo] outra execução do Prisma ainda está usando o lock de migrations; tentando novamente em ${retryDelayMs / 1_000}s.`,
      );
      await wait(retryDelayMs);
    }
  }
}
