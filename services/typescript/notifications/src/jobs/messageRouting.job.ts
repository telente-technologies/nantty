import type { Logger } from "@zudojs/logger";

import { bulkBatchJobType, digestJobType, unreadEmailJobType } from "../constants/delivery.constant.js";
import type { Container } from "../container.js";
import { PoisonMessageError } from "../errors/poisonMessage.error.js";
import { parseDomainEventEnvelope, unwrapQueueMessageBody } from "../modules/eventIngestion/validators/domainEvent.validator.js";

type Handlers = Pick<Container, "handleDomainEvent" | "processBulkBatch" | "deliverEmailIfStillUnread" | "recordSesFeedback" | "runDigestBatch">;

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
    } else if (job["type"] === unreadEmailJobType) {
      await handlers.deliverEmailIfStillUnread.execute(job as never);
    } else if (job["type"] === digestJobType && handlers.runDigestBatch !== null && typeof job["periodKey"] === "string" && ["weekly", "followRequests", "messageRequests"].includes(String(job["kind"]))) {
      await handlers.runDigestBatch.execute({ kind: job["kind"] as "weekly", periodKey: job["periodKey"], cursor: typeof job["cursor"] === "string" ? job["cursor"] : null });
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
