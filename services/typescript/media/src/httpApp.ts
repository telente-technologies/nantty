import { createPlatform, createResponseContext, HttpMiddlewarePipeline, sendLegacyResponse } from "@nantty/fastify-platform";

import type { MediaDatabase } from "./databases/prisma.database.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { registerRoutes } from "./routes/index.js";
import { createLegacyRouteContext } from "./routes/routeAdapter.js";
import type { HandlerContext } from "./types/handlerContext.type.js";
import { createRouteFactory } from "./utils/route.util.js";

export const defaultBodyLimitBytes = 1024 * 1024;
export const proxiedChunkLimitBytes = 65 * 1024 * 1024;

export async function createMediaHttpApp(context: HandlerContext, database: MediaDatabase = context.database) {
  const { config } = context;
  const app = await createPlatform({
    name: "media", host: config.host, port: config.port,
    bodyLimit: config.allowProxiedChunks ? proxiedChunkLimitBytes : defaultBodyLimitBytes,
    trustProxy: true, logger: false, rateLimit: false,
  });
  // Chunk checksums and upload handlers must see the original bytes for every MIME type.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => done(null, body));
  const identity = new HttpMiddlewarePipeline({ middlewares: [createGatewayIdentityMiddleware(config.gatewayIdentitySecrets ?? [])] });
  app.addHook("onRequest", async (request, reply) => {
    const response = await identity.execute(createLegacyRouteContext(request).request, createResponseContext({ status: 204 }));
    if (response.status !== 204) sendLegacyResponse(reply, response);
  });
  registerRoutes(app, createRouteFactory(config.internalToken), context, database);
  return app;
}
