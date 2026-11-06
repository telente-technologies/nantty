import { HttpMiddlewarePipeline, createLogger, createPlatform, createRequestContext, createResponseContext, sendLegacyResponse, type HttpRequestContext, type Logger } from "@nantty/fastify-platform";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { NotificationsConfig } from "./configs/notifications.config.js";
import { createGatewayIdentityMiddleware } from "./middlewares/gatewayIdentity.middleware.js";
import { checkRabbitMqConnections } from "./integrations/rabbitMqConnection.integration.js";
import { createContainer, type Container, type ContainerOverrides } from "./container.js";
import { createDomainEventMessageHandler, createJobMessageHandler, createSesFeedbackMessageHandler } from "./jobs/messageRouting.job.js";
import { DigestSchedulerJob } from "./jobs/digestScheduler.job.js";
import { ReengagementSchedulerJob } from "./jobs/reengagementScheduler.job.js";
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
  let fastify: FastifyInstance | undefined;
  const server = {
    async start() {
      fastify = await createPlatform({ name: "notifications", host: config.host, port: config.port, bodyLimit: 1024 * 1024, trustProxy: true, logger: true, rateLimit: false });
      const dispatch = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const parsed = new URL(request.url, "http://notifications.invalid");
        const headers = Object.fromEntries(Object.entries(request.headers).flatMap(([name, value]) => value === undefined ? [] : [[name, Array.isArray(value) ? value.join(",") : String(value)]]));
        const context = createRequestContext({ id: request.id, method: request.method, url: request.url, path: parsed.pathname, headers, body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body, remoteAddress: request.ip, protocol: request.protocol, hostname: request.hostname, signal: request.raw.signal });
        sendLegacyResponse(reply, await withRequestMetrics((entry: HttpRequestContext) => pipeline.execute(entry, createResponseContext()))(context));
      };
      fastify.all("/", dispatch);
      fastify.all("/*", dispatch);
      await fastify.listen({ host: config.host, port: config.port });
    },
    async stop() { await fastify?.close(); },
  };
  const consumers = config.consumersEnabled
    ? [
      container.broker.createConsumer("domainEvents", config.queues.domainEvents, createDomainEventMessageHandler(container, logger)),
      container.broker.createConsumer("jobs", config.queues.jobs, createJobMessageHandler(container, logger)),
      ...(container.sesFeedbackReader === null ? [] : [new QueueConsumerJob("sesFeedback", config.queues.sesFeedback, container.sesFeedbackReader, createSesFeedbackMessageHandler(container, logger), logger)]),
    ]
    : [];
  const digestScheduler = config.consumersEnabled && container.runDigestBatch !== null ? new DigestSchedulerJob(container.broker, config.queues.jobs) : null;
  const reengagementScheduler = config.consumersEnabled ? new ReengagementSchedulerJob(container.reengagementRepository, container.broker, config.queues.jobs, logger, config.reengagement) : null;
  const outboxRelay = config.consumersEnabled ? new OutboxRelayJob(() => relayPendingOutboxEvents(container.prisma, container.broker), logger) : null;
  return {
    container,
    server,
    logger,
    async start() {
      await server.start();
      for (const consumer of consumers) consumer.start();
      digestScheduler?.start();
      reengagementScheduler?.start();
      outboxRelay?.start();
    },
    async stop() {
      digestScheduler?.stop();
      reengagementScheduler?.stop();
      outboxRelay?.stop();
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await server.stop();
      await container.broker.close();
      await container.prisma.$disconnect();
    },
  };
}
