import type { HttpRouter } from "@zudojs/http";

import type { MediaDatabase } from "../databases/prisma.database.js";
import { json } from "../utils/http.util.js";

export function registerHealthRoutes(router: HttpRouter, database: MediaDatabase, capabilities: () => Promise<Record<string, unknown> & { readonly healthy: boolean }>): void {
  router.get("/healthz", () => json(200, { status: "up", service: "media" }));
  router.get("/readyz", async () => {
    try {
      await database.client.outboxEvent.count({ take: 1 });
      const { healthy, ...details } = await capabilities();
      return healthy ? json(200, { status: "ready", ...details }) : json(503, { status: "unavailable", ...details });
    } catch {
      return json(503, { status: "unavailable" });
    }
  });
}
