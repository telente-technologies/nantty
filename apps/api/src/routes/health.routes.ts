import type { HttpRouter } from "@zudojs/http";

import { json } from "../utils/http.js";

/** What /health reports. */
export interface HealthReport {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, "up" | "down">>;
}

/** Computes the current {@link HealthReport}. */
export type HealthCheck = () => Promise<HealthReport>;

/**
 * GET /health: 200 when the runtime is running and every integration is
 * up, 503 otherwise. Hidden from the OpenAPI document.
 */
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
