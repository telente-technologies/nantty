import { Scheduler } from "@zudojs/scheduler";

import type { Integration } from "./lifecycle.integration.js";

let scheduler: Scheduler | undefined;

export function schedules(): Scheduler {
  if (scheduler === undefined) {
    throw new Error("The scheduler is not running: start the runtime first.");
  }
  return scheduler;
}

export const schedulerIntegration: Integration = {
  name: "scheduler",

  async start({ logger }) {
    scheduler = new Scheduler({
      onError: ({ jobId, error }) => logger.error("Scheduled job failed", { jobId, error }),
    });
    scheduler.start();
  },

  async stop() {
    await scheduler?.stop({ timeoutMs: 10_000 });
    scheduler = undefined;
  },

  async health() {
    return scheduler !== undefined;
  },
};
