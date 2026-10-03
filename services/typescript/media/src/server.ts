import { createLogger } from "@zudojs/logger";

import { createMediaApp } from "./app.js";
import { loadMediaConfigFromEnvironment } from "./configs/media.config.js";

const logger = createLogger({ name: "media" });
const config = loadMediaConfigFromEnvironment();
const app = createMediaApp(config, logger);

const port = await app.start();
logger.info("media listening", { host: config.host, port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void app.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("media shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
