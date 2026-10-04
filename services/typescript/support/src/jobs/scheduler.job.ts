import type { Logger } from "@zudojs/logger";

export interface ScheduledTask {
  readonly name: string;
  readonly intervalMs: number;
  readonly run: () => Promise<unknown>;
}

export function startScheduledTasks(tasks: readonly ScheduledTask[], logger: Logger): () => void {
  const timers: NodeJS.Timeout[] = [];
  let stopped = false;
  for (const task of tasks) {
    let running = false;
    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        await task.run();
      } catch (error) {
        logger.warn("scheduled task failed", { task: task.name, error: error instanceof Error ? error.message : String(error) });
      } finally {
        running = false;
      }
    };
    void tick();
    timers.push(setInterval(() => void tick(), task.intervalMs));
  }
  return () => {
    stopped = true;
    for (const timer of timers) clearInterval(timer);
  };
}
