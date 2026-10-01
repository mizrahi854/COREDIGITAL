export async function register() {
  // Runs the Postgres-backed job worker (reel processing, notification delivery)
  // inside the web process unless a separate `npm run worker` is used.
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_WORKER_IN_APP !== "false") {
    const { startWorkerLoop } = await import("./server/jobs");
    startWorkerLoop();
  }
}
