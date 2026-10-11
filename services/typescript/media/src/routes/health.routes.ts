import type { HttpRouter } from "@zudojs/http";

import type { MediaDatabase } from "../databases/prisma.database.js";
import { checkRabbitMqConnections } from "../integrations/rabbitMqConnection.integration.js";
import { json } from "../utils/http.util.js";
import { runReadinessChecks } from "../utils/readiness.util.js";

type CapabilityHealth = Record<string, unknown> & { readonly healthy: boolean };

export function registerHealthRoutes(router: HttpRouter, database: MediaDatabase, capabilities: () => Promise<CapabilityHealth>, checkBroker: () => Promise<void> = checkRabbitMqConnections): void {
  router.get("/healthz", () => json(200, { status: "up", service: "media" }));
  router.get("/readyz", async () => {
    let details: Record<string, unknown> = {};
    const { ready } = await runReadinessChecks({
      database: () => database.client.outboxEvent.count({ take: 1 }),
      rabbitmq: checkBroker,
      capabilities: async () => {
        const { healthy, ...rest } = await capabilities();
        details = rest;
        if (!healthy) throw new Error("required media capability is unavailable");
      },
    });
    return ready ? json(200, { status: "ready", ...details }) : json(503, { status: "unavailable", ...details });
  });
}
