import { HttpMiddlewarePipeline, createHttpServer, createNodeHttpAdapter, createResponseContext, createRouter, type HttpRequestContext } from "@zudojs/http";

import { registerRoutes, type RouteDependencies } from "../../src/routes/index.js";
import { errorToResponse, json } from "../../src/utils/http.util.js";

export async function startTestServer(dependencies: RouteDependencies) {
  const router = createRouter({
    onError: (error) => errorToResponse(error) ?? json(500, { message: "Internal Server Error", code: "INTERNAL_ERROR" }),
    notFoundHandler: () => json(404, { message: "Not found.", code: "NOT_FOUND" }),
    methodNotAllowedHandler: () => json(405, { message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }),
  });
  registerRoutes(router, dependencies);
  const pipeline = new HttpMiddlewarePipeline({ middlewares: [async (context) => (await router.dispatch(context.request, { signal: context.signal })).response] });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: "127.0.0.1", port: 0, maxBodySize: 65_536, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
  await server.start();
  const baseUrl = `http://127.0.0.1:${server.address?.port}`;
  return { baseUrl, stop: async () => void (await server.stop()) };
}
