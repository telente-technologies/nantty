import { createRequestContext, type HttpRouterContext } from "@zudojs/http";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { createIndexingController } from "../modules/indexing/controllers/indexing.controller.js";
import type { SearchEventProcessor } from "../modules/indexing/services/searchEventProcessor.service.js";
import { createRecentSearchesController } from "../modules/recentSearches/controllers/recentSearches.controller.js";
import { createSearchController } from "../modules/search/controllers/search.controller.js";
import type { SearchQueryService } from "../modules/search/services/searchQuery.service.js";
import type { RecentSearchStore } from "../interfaces/searchStore.interface.js";
import { runReadinessChecks } from "../utils/readiness.util.js";
import { sendLegacyResponse } from "@nantty/fastify-platform";

export interface RouteDependencies {
  readonly searchService: SearchQueryService;
  readonly recentSearches: RecentSearchStore;
  readonly eventProcessor: SearchEventProcessor;
  readonly internalToken: string;
  readonly probeDatabase: (() => Promise<void>) | undefined;
  readonly probeBroker?: () => Promise<void>;
}

function controllerContext(request: FastifyRequest): HttpRouterContext {
  const parsed = new URL(request.url, "http://localhost");
  const query = Object.fromEntries(Array.from(new Set(parsed.searchParams.keys())).map((key) => {
    const values = parsed.searchParams.getAll(key);
    return [key, values.length > 1 ? values : values[0] ?? ""];
  }));
  const headers = Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(",") : String(value)]]));
  const context = createRequestContext({ method: request.method, url: request.url, path: parsed.pathname, headers, query, params: request.params as Record<string, string>, body: request.body, remoteAddress: request.ip, signal: request.raw.signal });
  return { request: context, params: request.params as Record<string, string>, query, route: undefined as never, state: new Map(), middleware: undefined as never, signal: request.raw.signal };
}

async function invoke(reply: FastifyReply, request: FastifyRequest, handler: (context: HttpRouterContext) => Promise<import("@zudojs/http").HttpResponseContext>): Promise<void> {
  sendLegacyResponse(reply, await handler(controllerContext(request)));
}

export function registerRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  const recent = createRecentSearchesController(dependencies.recentSearches);
  const search = createSearchController(dependencies.searchService);
  const indexing = createIndexingController(dependencies.eventProcessor, dependencies.internalToken);

  app.get("/healthz", async () => ({ status: "up", service: "search" }));
  app.get("/readyz", async (_request, reply) => {
    const { ready } = await runReadinessChecks({ database: async () => dependencies.probeDatabase?.(), rabbitmq: async () => dependencies.probeBroker?.() });
    return reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "unavailable" });
  });
  app.get("/api/v1/search", (request, reply) => invoke(reply, request, search.search));
  app.get("/api/v1/search/suggest", (request, reply) => invoke(reply, request, search.suggest));
  app.get("/api/v1/search/recent", (request, reply) => invoke(reply, request, recent.list));
  app.post("/api/v1/search/recent", (request, reply) => invoke(reply, request, recent.record));
  app.delete("/api/v1/search/recent/:id", (request, reply) => invoke(reply, request, recent.remove));
  app.delete("/api/v1/search/recent", (request, reply) => invoke(reply, request, recent.clear));
  app.post("/internal/search/events", (request, reply) => invoke(reply, request, indexing.ingestEvent));
  app.get("/internal/search/event-types", (request, reply) => invoke(reply, request, indexing.listHandledEventTypes));
}
