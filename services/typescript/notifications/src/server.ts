import { createLogger } from "@zudojs/logger";

import { createNotificationsApp } from "./app.js";
import { loadNotificationsConfigFromEnvironment } from "./configs/notifications.config.js";

const logger = createLogger({ name: "notifications" });
const config = loadNotificationsConfigFromEnvironment();
const app = createNotificationsApp(config, { logger });

await app.start();
logger.info("notifications listening", { host: config.host, port: config.port, consumers: config.consumersEnabled });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("notifications shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
