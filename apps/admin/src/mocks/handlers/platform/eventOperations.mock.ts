import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

const demoQueues = [
  { name: "commerce-domain-events", state: "running", messages: 12, messages_ready: 4, messages_unacknowledged: 8, consumers: 3 },
  { name: "commerce-domain-events.dlq", state: "running", messages: 2, messages_ready: 2, messages_unacknowledged: 0, consumers: 0 },
  { name: "identity-domain-events", state: "running", messages: 0, messages_ready: 0, messages_unacknowledged: 0, consumers: 2 },
];

export function registerEventOperationsMockHandlers(): void {
  registerMockRoute("GET", "/admin/event-operations/queues", (request) => {
    requireMockPermission(request, "events:read");
    const data = demoQueues.map((queue) => ({
      name: queue.name,
      state: queue.state,
      messages: queue.messages,
      messagesReady: queue.messages_ready,
      messagesUnacknowledged: queue.messages_unacknowledged,
      consumers: queue.consumers,
      deadLetter: queue.name.endsWith(".dlq"),
    }));
    return respondWithJson(200, {
      data,
      summary: {
        queueCount: data.length,
        deadLetterQueueCount: data.filter((queue) => queue.deadLetter).length,
        readyMessages: data.reduce((sum, queue) => sum + queue.messagesReady, 0),
        unacknowledgedMessages: data.reduce((sum, queue) => sum + queue.messagesUnacknowledged, 0),
        deadLetterReadyMessages: data.filter((queue) => queue.deadLetter).reduce((sum, queue) => sum + queue.messagesReady, 0),
      },
      consumers: {
        status: "available",
        registrations: [
          { queueName: "commerce-domain-events", ackRequired: true, prefetchCount: 20, exclusive: false },
          { queueName: "identity-domain-events", ackRequired: true, prefetchCount: 10, exclusive: false },
        ],
      },
    });
  });
}
