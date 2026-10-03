import type { HttpRouter } from "@zudojs/http";

import type { SocialDatabase } from "../databases/prisma.database.js";
import { json } from "../utils/http.util.js";

export function registerHealthRoutes(router: HttpRouter, database: SocialDatabase): void {
  router.get("/healthz", () => json(200, { status: "up", service: "social" }));
  router.get("/readyz", async () => {
    try {
      await database.client.outboxEvent.count({ take: 1 });
      return json(200, { status: "ready" });
    } catch {
      return json(503, { status: "unavailable" });
    }
  });
}
