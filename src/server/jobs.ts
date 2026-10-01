import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { processReel } from "./media";
import { deliverDueNotifications } from "./notifications";

/**
 * Postgres-backed job queue. Jobs survive restarts; claiming uses
 * FOR UPDATE SKIP LOCKED so multiple workers never run the same job.
 */
export async function enqueue(type: string, payload: Prisma.InputJsonValue, db: Tx = prisma, runAt = new Date()) {
  await db.job.create({ data: { type, payload, runAt } });
}

async function claimJob() {
  const rows = await prisma.$queryRaw<{ id: string; type: string; payload: unknown; attempts: number }[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'PENDING' AND "runAt" <= now())
         OR ("status" = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes')
      ORDER BY "runAt" LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) RETURNING "id", "type", "payload", "attempts"`;
  return rows[0] ?? null;
}

async function runJob(job: { id: string; type: string; payload: unknown; attempts: number }) {
  try {
    if (job.type === "process_reel") {
      await processReel((job.payload as { reelId: string }).reelId);
    }
    await prisma.job.update({ where: { id: job.id }, data: { status: "DONE" } });
  } catch (e) {
    const failed = job.attempts >= 3;
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: failed ? "FAILED" : "PENDING",
        lastError: String(e),
        runAt: new Date(Date.now() + 30_000 * job.attempts),
      },
    });
  }
}

async function housekeeping() {
  await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 3600_000) } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

let lastHousekeeping = 0;

export async function tick() {
  let n = 0;
  for (let job = await claimJob(); job; job = await claimJob()) {
    await runJob(job);
    if (++n > 20) break;
  }
  await deliverDueNotifications();
  if (Date.now() - lastHousekeeping > 10 * 60_000) {
    lastHousekeeping = Date.now();
    await housekeeping();
  }
}

export function startWorkerLoop(intervalMs = 4000) {
  const g = globalThis as unknown as { __buberWorker?: boolean };
  if (g.__buberWorker) return;
  g.__buberWorker = true;
  let running = false;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (e) {
      console.error("[worker]", e);
    } finally {
      running = false;
    }
  };
  setInterval(loop, intervalMs);
  void loop();
  console.log("[worker] started");
}
