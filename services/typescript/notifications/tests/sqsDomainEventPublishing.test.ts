import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@nantty/fastify-platform";

import type { PublishableDomainEvent } from "../src/interfaces/domainEventPublisher.interface.js";
import { SqsMessageBroker, type SqsQueueClient } from "../src/integrations/sqs.integration.js";

describe("SQS domain event publishing", () => {
  it("fails closed rather than letting the outbox mark unpublished events as sent", async () => {
    const logger = { error: vi.fn() } as unknown as Logger;
    const broker = new SqsMessageBroker({} as SqsQueueClient, logger);
    const events: PublishableDomainEvent[] = [{ id: "evt-1", eventType: "orderGroup.paid", subject: "order-1", payload: { id: "evt-1" } }];

    await expect(broker.publishDomainEvents(events)).rejects.toThrow("cannot publish domain events");
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
