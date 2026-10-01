import { startWorkerLoop } from "../src/server/jobs";

// Standalone worker: run with RUN_WORKER_IN_APP=false on the web servers.
startWorkerLoop(3000);
