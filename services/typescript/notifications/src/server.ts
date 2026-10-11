import { createLogger } from "@zudojs/logger";

import { createNotificationsApp } from "./app.js";
import { loadNotificationsConfigFromEnvironment } from "./configs/notifications.config.js";
import { startTelemetry } from "./telemetry/telemetry.js";

// ESM imports load before this runs, so node:http auto-instrumentation may miss; RED metrics are recorded explicitly.
const stopTelemetry = startTelemetry("notifications");
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
    void app.stop().finally(stopTelemetry).then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("notifications shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
