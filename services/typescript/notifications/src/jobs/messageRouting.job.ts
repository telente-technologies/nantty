import type { Logger } from "@nantty/fastify-platform";

import { bulkBatchJobType, digestJobType, failedEmailAlertJobType, postNotificationFanoutJobType, supportTicketAlertJobType, templateEmailJobType, unreadEmailJobType, widgetRefreshFanoutJobType } from "../constants/delivery.constant.js";
import type { Container } from "../container.js";
import { PoisonMessageError } from "../errors/poisonMessage.error.js";
import { isEmailTemplateKey } from "@nantty/email-templates";
import { parseDomainEventEnvelope, unwrapQueueMessageBody } from "../modules/eventIngestion/validators/domainEvent.validator.js";
import type { DeliverTemplateEmailCommand } from "../modules/delivery/commands/deliverTemplateEmail/deliverTemplateEmail.command.js";
import { parseWidgetRefreshFanoutJob } from "../modules/widgetRefresh/commands/sendWidgetRefresh/sendWidgetRefresh.handler.js";
import { parsePostNotificationFanoutJob } from "../modules/postNotifications/commands/runPostNotificationFanout/runPostNotificationFanout.handler.js";

type Handlers = Pick<Container, "handleDomainEvent" | "processBulkBatch" | "deliverEmailIfStillUnread" | "deliverTemplateEmail" | "deliverSupportTicketAlert" | "deliverFailedEmailAlert" | "recordSesFeedback" | "runDigestBatch" | "runPostNotificationFanout" | "sendWidgetRefresh">;
const preferenceCategories = new Set(["auth", "orders", "escrow", "seller", "payments", "creator", "checkmarks", "social", "milestones", "live", "trust", "privacy", "support", "marketing"]);

function parseTemplateEmailJob(job: Record<string, unknown>): DeliverTemplateEmailCommand | null {
  if (typeof job["dedupeKey"] !== "string" || job["dedupeKey"].length === 0 || typeof job["eventId"] !== "string" || job["eventId"].length === 0) return null;
  if (typeof job["userId"] !== "string" || job["userId"].length === 0 || typeof job["preferenceCategory"] !== "string" || !preferenceCategories.has(job["preferenceCategory"])) return null;
  if (typeof job["templateKey"] !== "string" || !isEmailTemplateKey(job["templateKey"]) || typeof job["props"] !== "object" || job["props"] === null) return null;
  if (job["attempt"] !== undefined && (!Number.isInteger(job["attempt"]) || Number(job["attempt"]) < 1 || Number(job["attempt"]) > 4)) return null;
  return { dedupeKey: job["dedupeKey"], eventId: job["eventId"], userId: job["userId"], preferenceCategory: job["preferenceCategory"] as DeliverTemplateEmailCommand["preferenceCategory"], templateKey: job["templateKey"], props: job["props"], ...(job["attempt"] === undefined ? {} : { attempt: Number(job["attempt"]) }) };
}

function parseJson(body: string): unknown {
  try {
    return unwrapQueueMessageBody(body);
  } catch {
    throw new PoisonMessageError("body is not JSON");
  }
}

export function createDomainEventMessageHandler(handlers: Handlers, logger: Logger): (body: string) => Promise<void> {
  return async (body) => {
    const event = parseDomainEventEnvelope(parseJson(body));
    if (event === null) throw new PoisonMessageError("invalid event envelope");
    await handlers.handleDomainEvent.execute({ event });
  };
}

export function createJobMessageHandler(handlers: Handlers, logger: Logger): (body: string) => Promise<void> {
  return async (body) => {
    const job = parseJson(body) as Record<string, unknown> | null;
    if (typeof job !== "object" || job === null) throw new PoisonMessageError("job is not an object");
    if (job["type"] === bulkBatchJobType && typeof job["campaignId"] === "string" && typeof job["batchIndex"] === "number") {
      await handlers.processBulkBatch.execute({ campaignId: job["campaignId"], batchIndex: job["batchIndex"], cursor: typeof job["cursor"] === "string" ? job["cursor"] : null });
    } else if (job["type"] === templateEmailJobType) {
      const email = parseTemplateEmailJob(job);
      if (email === null) throw new PoisonMessageError("invalid template email job");
      await handlers.deliverTemplateEmail.execute(email);
    } else if (job["type"] === supportTicketAlertJobType) {
      const event = parseDomainEventEnvelope(job["event"]);
      if (event === null || event.type !== "ticket.created") throw new PoisonMessageError("invalid support ticket alert job");
      await handlers.deliverSupportTicketAlert.execute(event);
    } else if (job["type"] === failedEmailAlertJobType) {
      if (typeof job["eventId"] !== "string" || job["eventId"].length === 0 || typeof job["templateKey"] !== "string" || job["templateKey"].length === 0 || typeof job["reason"] !== "string" || typeof job["address"] !== "string" || job["address"].length === 0) throw new PoisonMessageError("invalid failed email alert job");
      await handlers.deliverFailedEmailAlert.execute({ eventId: job["eventId"], templateKey: job["templateKey"], reason: job["reason"], address: job["address"] });
    } else if (job["type"] === unreadEmailJobType) {
      if (typeof job["eventId"] !== "string" || typeof job["userId"] !== "string" || typeof job["emailDedupeKey"] !== "string" || typeof job["notificationKey"] !== "string" || typeof job["notBefore"] !== "string" || typeof job["preferenceCategory"] !== "string" || !preferenceCategories.has(job["preferenceCategory"]) || typeof job["templateKey"] !== "string" || !isEmailTemplateKey(job["templateKey"]) || typeof job["props"] !== "object" || job["props"] === null) throw new PoisonMessageError("invalid deferred email job");
      if (job["attempt"] !== undefined && (!Number.isInteger(job["attempt"]) || Number(job["attempt"]) < 1 || Number(job["attempt"]) > 4)) throw new PoisonMessageError("invalid deferred email attempt");
      await handlers.deliverEmailIfStillUnread.execute(job as never);
    } else if (job["type"] === digestJobType && handlers.runDigestBatch !== null && typeof job["periodKey"] === "string" && ["weekly", "followRequests", "messageRequests"].includes(String(job["kind"]))) {
      await handlers.runDigestBatch.execute({ kind: job["kind"] as "weekly", periodKey: job["periodKey"], cursor: typeof job["cursor"] === "string" ? job["cursor"] : null });
    } else if (job["type"] === postNotificationFanoutJobType) {
      const fanout = parsePostNotificationFanoutJob(job);
      if (fanout === null) throw new PoisonMessageError("invalid post notification fanout job");
      if (handlers.runPostNotificationFanout === null) return void logger.warn("post notification fanout skipped: social source not configured", { eventId: fanout.eventId });
      await handlers.runPostNotificationFanout.execute(fanout);
    } else if (job["type"] === widgetRefreshFanoutJobType) {
      const refresh = parseWidgetRefreshFanoutJob(job);
      if (refresh === null) throw new PoisonMessageError("invalid widget refresh fanout job");
      await handlers.sendWidgetRefresh.runFanout(refresh);
    } else {
      logger.warn("unknown job type dead-lettered", { type: String(job["type"]) });
      throw new PoisonMessageError(`unknown job type ${String(job["type"])}`);
    }
  };
}

export function createSesFeedbackMessageHandler(handlers: Handlers, logger: Logger): (body: string) => Promise<void> {
  return async (body) => {
    await handlers.recordSesFeedback.execute({ feedback: parseJson(body) });
  };
}
