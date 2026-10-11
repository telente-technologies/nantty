export type ReadinessCheck = () => Promise<unknown>;

export interface ReadinessResult {
  readonly ready: boolean;
  readonly checks: Record<string, "up" | "down">;
}

function withTimeout(check: ReadinessCheck, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("readiness check timed out")), timeoutMs);
  });
  return Promise.race([Promise.resolve().then(check), timeout]).finally(() => clearTimeout(timer));
}

export async function runReadinessChecks(checks: Record<string, ReadinessCheck>, timeoutMs = 2000): Promise<ReadinessResult> {
  const entries = await Promise.all(Object.entries(checks).map(async ([name, check]) => {
    const outcome = await withTimeout(check, timeoutMs).then(() => "up" as const, () => "down" as const);
    return [name, outcome] as const;
  }));
  const results: Record<string, "up" | "down"> = Object.fromEntries(entries);
  return { ready: Object.values(results).every((status) => status === "up"), checks: results };
}
