import { createLogger } from "@nantty/fastify-platform";

import { createSearchApp } from "./app.js";
import { createRabbitMqMessageConsumerFactory } from "./integrations/rabbitMqMessageConsumerFactory.integration.js";
import { loadSearchConfigFromEnvironment } from "./configs/search.config.js";
import { startTelemetry } from "./telemetry/telemetry.js";

// ESM imports load before this runs, so node:http auto-instrumentation may miss; RED metrics are recorded explicitly.
const stopTelemetry = startTelemetry("search");
const logger = createLogger({ name: "search" });
const config = loadSearchConfigFromEnvironment();
const consumerFactory = config.rabbitMq === undefined ? undefined : createRabbitMqMessageConsumerFactory(config.rabbitMq.url, config.rabbitMq.prefetch, logger);
const app = await createSearchApp(config, consumerFactory, logger);

const port = await app.start();
logger.info("search listening", { host: config.host, port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().finally(stopTelemetry).then(
      async () => {
        await consumerFactory?.close();
        process.exit(0);
      },
      (error: unknown) => {
        logger.error("search shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
