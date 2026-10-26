import { createPlatform } from "@nantty/fastify-platform";

import { registerRoutes, type RouteDependencies } from "../../src/routes/index.js";

export async function startTestServer(dependencies: RouteDependencies) {
  const server = await createPlatform({ name: "search-test", host: "127.0.0.1", port: 0, bodyLimit: 65_536, trustProxy: true, logger: false, rateLimit: false });
  registerRoutes(server, dependencies);
  await server.listen({ host: "127.0.0.1", port: 0 });
  const address = server.server.address();
  if (typeof address !== "object" || address === null) throw new Error("test server failed to bind");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { baseUrl, stop: async () => void (await server.close()) };
}
