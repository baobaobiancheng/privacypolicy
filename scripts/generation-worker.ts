import { hostname } from "node:os";
import { getPrisma } from "../src/data/prisma";
import { processNextGenerationJob } from "../src/application/generation/job-service";

const POLL_MS = Number(process.env.GENERATION_WORKER_POLL_MS ?? 1_500);
const workerId = `${hostname()}:${process.pid}`;
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  console.info(JSON.stringify({ level: "info", event: "generation_worker_started", workerId }));
  while (!stopping) {
    const processed = await processNextGenerationJob(prisma, workerId).catch((error) => {
      console.error(JSON.stringify({ level: "error", event: "generation_worker_loop_failed", workerId, error: String(error) }));
      return false;
    });
    if (!processed) await delay(POLL_MS);
  }
  await prisma.$disconnect();
  console.info(JSON.stringify({ level: "info", event: "generation_worker_stopped", workerId }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "fatal", event: "generation_worker_crashed", workerId, error: String(error) }));
  process.exitCode = 1;
});
