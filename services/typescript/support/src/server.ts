import { createLogger } from "@zudojs/logger";

import { createSupportApp } from "./app.js";
import { loadSupportConfigFromEnvironment } from "./configs/support.config.js";
import { createRabbitMqDomainEventPublisher } from "./integrations/rabbitMqDomainEventPublisher.integration.js";
import { createRabbitMqMessageConsumerFactory } from "./integrations/rabbitMqMessageConsumerFactory.integration.js";
import { startTelemetry } from "./telemetry/telemetry.js";

// ESM imports load before this runs, so node:http auto-instrumentation may miss; RED metrics are recorded explicitly.
const stopTelemetry = startTelemetry("support");
const logger = createLogger({ name: "support" });
const config = loadSupportConfigFromEnvironment();
const publisher = config.rabbitMq === undefined ? undefined : createRabbitMqDomainEventPublisher(config.rabbitMq.url);
const consumerFactory = config.rabbitMq === undefined ? undefined : createRabbitMqMessageConsumerFactory(config.rabbitMq.url, config.rabbitMq.prefetch, logger);
if (publisher === undefined) logger.warn("RABBITMQ_URL is not set: ticket events stay in the outbox until a broker is configured");
const app = createSupportApp(config, { ...(publisher === undefined ? {} : { publisher }), ...(consumerFactory === undefined ? {} : { consumerFactory }) }, logger);

const port = await app.start();
logger.info("support listening", { host: config.host, port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().finally(stopTelemetry).then(
      async () => {
        await Promise.all([publisher?.close(), consumerFactory?.close()]);
        process.exit(0);
      },
      (error: unknown) => {
        logger.error("support shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
