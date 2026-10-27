import { createLogger } from "@nantty/fastify-platform";

import { createGatewayServer } from "./app.js";
import { loadGatewayConfigFromEnvironment } from "./configs/gateway.config.js";
import { startTelemetry } from "./telemetry/telemetry.js";

// ESM imports load before this runs, so node:http auto-instrumentation may miss; RED metrics are recorded explicitly.
const stopTelemetry = startTelemetry("gateway");
const logger = createLogger({ name: "gateway" });
const config = loadGatewayConfigFromEnvironment();
const server = createGatewayServer({ config, logger });

await server.start();
logger.info("gateway listening", { host: config.host, port: server.address?.port ?? config.port });

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void server.stop().finally(stopTelemetry).then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error("gateway shutdown failed", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      },
    );
  });
}
