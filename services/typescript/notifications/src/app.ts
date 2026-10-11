import { HttpMiddlewarePipeline, createHttpServer, createNodeHttpAdapter, createResponseContext, type HttpRequestContext } from "@zudojs/http";
import { createLogger, type Logger } from "@zudojs/logger";

import type { NotificationsConfig } from "./configs/notifications.config.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { checkRabbitMqConnections } from "./integrations/rabbitMqConnection.integration.js";
import { createContainer, type Container, type ContainerOverrides } from "./container.js";
import { createDomainEventMessageHandler, createJobMessageHandler, createSesFeedbackMessageHandler } from "./jobs/messageRouting.job.js";
import { DigestSchedulerJob } from "./jobs/digestScheduler.job.js";
import { OutboxRelayJob, relayPendingOutboxEvents } from "./jobs/outboxRelay.job.js";
import { QueueConsumerJob } from "./jobs/queueConsumer.job.js";
import { createBulkCampaignRoutes } from "./modules/bulkCampaigns/routes/bulkCampaigns.routes.js";
import { createEmailTemplateRoutes } from "./modules/emailTemplates/routes/emailTemplates.routes.js";
import { createInboxRoutes } from "./modules/inbox/routes/inbox.routes.js";
import { createUnsubscribeRoutes } from "./modules/unsubscribe/routes/unsubscribe.routes.js";
import type { RouteDefinition } from "./types/route.type.js";
import { convertErrorToResponse, json } from "./utils/http.util.js";
import { matchRoute } from "./utils/routeMatcher.util.js";
import { runReadinessChecks } from "./utils/readiness.util.js";
import { markRequestRoute, withRequestMetrics } from "./telemetry/requestMetrics.js";

export function createRoutes(container: Container): readonly RouteDefinition[] {
  return [...createInboxRoutes(container), ...createUnsubscribeRoutes(container), ...createBulkCampaignRoutes(container), ...createEmailTemplateRoutes(container)];
}

async function checkReadiness(container: Container | undefined, checkBroker: () => Promise<void>) {
  if (container === undefined) return json(200, { status: "ready" });
  const { ready } = await runReadinessChecks({
    database: () => container.prisma.notification.count({ take: 1 }),
    rabbitmq: checkBroker,
  });
  return ready ? json(200, { status: "ready" }) : json(503, { status: "unavailable" });
}

export function createRequestHandler(routes: readonly RouteDefinition[], logger: Logger, container?: Container, checkBroker: () => Promise<void> = checkRabbitMqConnections) {
  return async (request: HttpRequestContext) => {
    if (request.path === "/healthz" || request.path === "/readyz") markRequestRoute(request, request.path);
    if (request.path === "/healthz") return json(200, { status: "up", service: "notifications" });
    if (request.path === "/readyz") return checkReadiness(container, checkBroker);
    const match = matchRoute(routes, request.method, request.path);
    if (match === undefined) return json(404, { message: "Not found.", code: "NOT_FOUND" });
    markRequestRoute(request, match.route.path);
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
  const handleRequest = createRequestHandler(createRoutes(container), logger, container);
  const pipeline = new HttpMiddlewarePipeline({
    middlewares: [createGatewayIdentityMiddleware(config.gatewayIdentitySecrets ?? []), async (context) => {
      const response = (await handleRequest(context.request)).clone();
      response.setHeader("x-request-id", context.request.id);
      response.setHeader("x-content-type-options", "nosniff");
      return response;
    }],
  });
  const server = createHttpServer({
    adapter: createNodeHttpAdapter({ host: config.host, port: config.port, maxBodySize: 1024 * 1024, trustProxy: true }),
    handler: withRequestMetrics((request: HttpRequestContext) => pipeline.execute(request, createResponseContext())),
  });
  const consumers = config.consumersEnabled
    ? [
      container.broker.createConsumer("domainEvents", config.queues.domainEvents, createDomainEventMessageHandler(container, logger)),
      container.broker.createConsumer("jobs", config.queues.jobs, createJobMessageHandler(container, logger)),
      ...(container.sesFeedbackReader === null ? [] : [new QueueConsumerJob("sesFeedback", config.queues.sesFeedback, container.sesFeedbackReader, createSesFeedbackMessageHandler(container, logger), logger)]),
    ]
    : [];
  const digestScheduler = config.consumersEnabled && container.runDigestBatch !== null ? new DigestSchedulerJob(container.broker, config.queues.jobs) : null;
  const outboxRelay = config.consumersEnabled ? new OutboxRelayJob(() => relayPendingOutboxEvents(container.prisma, container.broker), logger) : null;
  return {
    container,
    server,
    logger,
    async start() {
      await server.start();
      for (const consumer of consumers) consumer.start();
      digestScheduler?.start();
      outboxRelay?.start();
    },
    async stop() {
      digestScheduler?.stop();
      outboxRelay?.stop();
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await server.stop();
      await container.broker.close();
      await container.prisma.$disconnect();
    },
  };
}
