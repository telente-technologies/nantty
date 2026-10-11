import { createLogger } from "@zudojs/logger";

import { createSocialApp } from "./app.js";
import { loadSocialConfigFromEnvironment } from "./configs/social.config.js";
import { startTelemetry } from "./telemetry/telemetry.js";

// ESM imports load before this runs, so node:http auto-instrumentation may miss; RED metrics are recorded explicitly.
const stopTelemetry = startTelemetry("social");
const logger = createLogger({ name: "social" });
const config = loadSocialConfigFromEnvironment();
const app = createSocialApp(config, process.env["SOCIAL_INTERNAL_TOKEN"]?.trim() ?? "", logger);

const port = await app.start();
logger.info("social listening", { host: config.host, port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().finally(stopTelemetry).then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("social shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
