import { describe, expect, it } from "vitest";

import { waitFor } from "../src/apiClient.util.js";
import { writeSmokeReport } from "../src/smokeReport.util.js";

const managementUrl = process.env["SMOKE_RABBITMQ_MANAGEMENT_URL"] ?? "http://localhost:15672";
const managementAuthorization = `Basic ${Buffer.from(process.env["SMOKE_RABBITMQ_MANAGEMENT_CREDENTIALS"] ?? "zudomart:zudomart-local-only").toString("base64")}`;

interface QueueState {
  readonly name: string;
  readonly messages: number;
  readonly consumers: number;
}

async function readQueues(): Promise<QueueState[]> {
  const response = await fetch(`${managementUrl}/api/queues/zudomart?columns=name,messages,consumers`, { headers: { authorization: managementAuthorization } });
  return ((await response.json()) as Array<{ name: string; messages?: number; consumers?: number }>).map((queue) => ({ name: queue.name, messages: queue.messages ?? 0, consumers: queue.consumers ?? 0 }));
}

describe("RabbitMQ event flow", () => {
  it("has a consumer on every live domain-event queue", async () => {
    const queues = await readQueues();
    const mainQueues = queues.filter((queue) => queue.name.endsWith("-domain-events"));
    expect(mainQueues.length).toBeGreaterThan(5);
    expect(mainQueues.filter((queue) => queue.consumers === 0).map((queue) => queue.name)).toEqual([]);
  });

  it("drains the main queues", async () => {
    const drained = await waitFor(async () => {
      const busy = (await readQueues()).filter((queue) => !queue.name.includes(".") && queue.name !== "unrouted-events" && queue.consumers > 0 && queue.messages > 0);
      return busy.length === 0 ? true : undefined;
    }, 30_000, 1000);
    expect(drained, "some queues still hold messages").toBe(true);
  });

  it("keeps every dead-letter queue empty", async () => {
    const queues = await readQueues();
    writeSmokeReport("queues", queues);
    expect(queues.filter((queue) => queue.name.endsWith(".dlq") && queue.messages > 0).map((queue) => `${queue.name}=${queue.messages}`)).toEqual([]);
  });
});
