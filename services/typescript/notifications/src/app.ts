import { HttpMiddlewarePipeline, createHttpServer, createNodeHttpAdapter, createResponseContext, type HttpRequestContext } from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import type { NotificationsConfig } from "./configs/notifications.config.js";
import { createContainer, type Container, type ContainerOverrides } from "./container.js";
import { createDomainEventMessageHandler, createJobMessageHandler, createSesFeedbackMessageHandler } from "./jobs/messageRouting.job.js";
import { DigestSchedulerJob } from "./jobs/digestScheduler.job.js";
import { QueueConsumerJob } from "./jobs/queueConsumer.job.js";
import { createBulkCampaignRoutes } from "./modules/bulkCampaigns/routes/bulkCampaigns.routes.js";
import { createInboxRoutes } from "./modules/inbox/routes/inbox.routes.js";
import { createUnsubscribeRoutes } from "./modules/unsubscribe/routes/unsubscribe.routes.js";
import type { RouteDefinition } from "./types/route.type.js";
import { convertErrorToResponse, json } from "./utils/http.util.js";
import { matchRoute } from "./utils/routeMatcher.util.js";

export function createRoutes(container: Container): readonly RouteDefinition[] {
  return [...createInboxRoutes(container), ...createUnsubscribeRoutes(container), ...createBulkCampaignRoutes(container)];
}

export function createRequestHandler(routes: readonly RouteDefinition[], logger: Logger) {
  return async (request: HttpRequestContext) => {
    if (request.path === "/healthz") return json(200, { status: "up", service: "notifications" });
    const match = matchRoute(routes, request.method, request.path);
    if (match === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    try {
      return await match.route.handler({ request, params: match.params });
    } catch (error) {
      if (!(error instanceof Error && "status" in error)) logger.error("request failed", { path: request.path, error: error instanceof Error ? error.message : String(error) });
      return convertErrorToResponse(error);
    }
  };
}

export function createNotificationsApp(config: NotificationsConfig, options: { readonly logger?: Logger; readonly overrides?: ContainerOverrides } = {}) {
  const logger = options.logger ?? createLogger({ name: "notifications" });
  const container = createContainer(config, logger, options.overrides);
  const handleRequest = createRequestHandler(createRoutes(container), logger);
  const pipeline = new HttpMiddlewarePipeline({
    middlewares: [async (context) => {
      const response = (await handleRequest(context.request)).clone();
      response.setHeader("x-request-id", context.request.id);
      response.setHeader("x-content-type-options", "nosniff");
      return response;
    }],
  });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: 1024 * 1024, trustProxy: true }),
    handler: (request: HttpRequestContext) => pipeline.execute(request, createResponseContext()),
  });
  const consumers = config.consumersEnabled
    ? [
      container.broker.createConsumer("domainEvents", config.queues.domainEvents, createDomainEventMessageHandler(container, logger)),
      container.broker.createConsumer("jobs", config.queues.jobs, createJobMessageHandler(container, logger)),
      ...(container.sesFeedbackReader === null ? [] : [new QueueConsumerJob("sesFeedback", config.queues.sesFeedback, container.sesFeedbackReader, createSesFeedbackMessageHandler(container, logger), logger)]),
    ]
    : [];
  const digestScheduler = config.consumersEnabled && container.runDigestBatch !== null ? new DigestSchedulerJob(container.broker, config.queues.jobs) : null;
  return {
    container,
    server,
    logger,
    async start() {
      await server.start();
      for (const consumer of consumers) consumer.start();
      digestScheduler?.start();
    },
    async stop() {
      digestScheduler?.stop();
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await server.stop();
      await container.broker.close();
      await container.prisma.$disconnect();
    },
  };
}
