import type { FastifyInstance } from "fastify";

import type { MediaDatabase } from "../databases/prisma.database.js";
import { checkRabbitMqConnections } from "../integrations/rabbitMqConnection.integration.js";
import { runReadinessChecks } from "../utils/readiness.util.js";

type CapabilityHealth = Record<string, unknown> & { readonly healthy: boolean };

export function registerHealthRoutes(app: FastifyInstance, database: MediaDatabase, capabilities: () => Promise<CapabilityHealth>, checkBroker: () => Promise<void> = checkRabbitMqConnections): void {
  app.get("/healthz", async (_request, reply) => reply.code(200).send({ status: "up", service: "media" }));
  app.get("/readyz", async (_request, reply) => {
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
    return reply.code(ready ? 200 : 503).send(ready ? { status: "ready", ...details } : { status: "unavailable", ...details });
  });
}
