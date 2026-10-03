import { createLogger } from "@zudojs/logger";

import { createSearchApp } from "./app.js";
import { createRabbitMqMessageConsumerFactory } from "./integrations/rabbitMqMessageConsumerFactory.integration.js";
import { loadSearchConfigFromEnvironment } from "./configs/search.config.js";

const logger = createLogger({ name: "search" });
const config = loadSearchConfigFromEnvironment();
const consumerFactory = config.rabbitMq === undefined ? undefined : createRabbitMqMessageConsumerFactory(config.rabbitMq.url, config.rabbitMq.prefetch, logger);
const app = createSearchApp(config, consumerFactory, logger);

const port = await app.start();
logger.info("search listening", { host: config.host, port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().then(
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
