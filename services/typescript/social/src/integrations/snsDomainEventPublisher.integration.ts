import { PublishBatchCommand, SNSClient } from "@aws-sdk/client-sns";

import type { DomainEventPublisher, PublishableDomainEvent } from "../interfaces/domainEventPublisher.interface.js";

const snsBatchLimit = 10;

export interface SnsPublisherOptions {
  readonly topicArn: string;
  readonly region: string;
  readonly endpoint: string | undefined;
}

export function createSnsDomainEventPublisher(options: SnsPublisherOptions): DomainEventPublisher {
  const client = new SNSClient({ region: options.region, ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }) });
  return {
    async publishDomainEvents(events: readonly PublishableDomainEvent[]) {
      for (let start = 0; start < events.length; start += snsBatchLimit) {
        const batch = events.slice(start, start + snsBatchLimit);
        const output = await client.send(new PublishBatchCommand({
          TopicArn: options.topicArn,
          PublishBatchRequestEntries: batch.map((event) => ({
            Id: event.id,
            Message: JSON.stringify(event.payload),
            MessageAttributes: { eventType: { DataType: "String", StringValue: event.eventType } },
          })),
        }));
        if ((output.Failed?.length ?? 0) > 0) throw new Error(`publish domain events: ${output.Failed?.length} of ${batch.length} failed`);
      }
    },
  };
}

export const noopDomainEventPublisher: DomainEventPublisher = { publishDomainEvents: async () => undefined };
