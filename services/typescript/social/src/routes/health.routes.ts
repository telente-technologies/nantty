import type { HttpRouter } from "@nantty/fastify-platform";

import type { SocialDatabase } from "../databases/prisma.database.js";
import { checkRabbitMqConnections } from "../integrations/rabbitMqConnection.integration.js";
import { json } from "../utils/http.util.js";
import { runReadinessChecks } from "../utils/readiness.util.js";

export function registerHealthRoutes(router: HttpRouter, database: SocialDatabase, checkBroker: () => Promise<void> = checkRabbitMqConnections): void {
  router.get("/healthz", () => json(200, { status: "up", service: "social" }));
  router.get("/readyz", async () => {
    const { ready } = await runReadinessChecks({
      database: () => database.client.outboxEvent.count({ take: 1 }),
      rabbitmq: checkBroker,
    });
    return ready ? json(200, { status: "ready" }) : json(503, { status: "unavailable" });
  });
}
