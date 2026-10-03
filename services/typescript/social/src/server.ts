import { createLogger } from "@zudojs/logger";

import { createSocialApp } from "./app.js";
import { loadSocialConfigFromEnvironment } from "./configs/social.config.js";

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
    void app.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("social shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
