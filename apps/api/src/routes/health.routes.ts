import type { HttpRouter } from "@zudojs/http";

import { json } from "../utils/http.util.js";

export interface HealthReport {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, "up" | "down">>;
}

export type HealthCheck = () => Promise<HealthReport>;

export function registerHealthRoutes(router: HttpRouter, check: HealthCheck): void {
  router.get(
    "/health",
    async () => {
      const report = await check();
      return json(report.ready ? 200 : 503, {
        status: report.ready ? "ok" : "unavailable",
        checks: report.checks,
        timestamp: new Date().toISOString(),
      });
    },
    { openapi: false },
  );
}
