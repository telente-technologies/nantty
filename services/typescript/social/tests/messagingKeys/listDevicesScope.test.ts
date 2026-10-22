import { describe, expect, it } from "vitest";

import { createListDevicesHandler } from "../../src/modules/messagingKeys/queries/listDevices/listDevices.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const requesterId = "0192a4f0-0000-7000-8000-00000000aaaa";
const peerId = "0192a4f0-0000-7000-8000-00000000bbbb";
const strangerId = "0192a4f0-0000-7000-8000-00000000cccc";

function context() {
  const queried: string[][] = [];
  const client = {
    conversationMember: {
      findMany: async () => [{ accountId: requesterId }, { accountId: peerId }],
    },
    chatDeviceKey: {
      findMany: async ({ where }: { where: { accountId: { in: string[] } } }) => {
        queried.push(where.accountId.in);
        return where.accountId.in.flatMap((accountId) => [
          { accountId, deviceId: `${accountId}-device`, registrationId: 1, identityKey: "a".repeat(44) },
        ]);
      },
    },
  };
  return { handler: createListDevicesHandler({ database: { client } } as unknown as HandlerContext), queried };
}

describe("messaging key device directory", () => {
  it("returns devices only for the requester and people they already share a conversation with", async () => {
    const { handler, queried } = context();
    const result = await handler({ requesterId, userIds: [requesterId, peerId, strangerId] });

    expect(queried).toEqual([[requesterId, peerId]]);
    expect(result.data.map((entry) => [entry.userId, entry.devices.length])).toEqual([
      [requesterId, 1],
      [peerId, 1],
      [strangerId, 0],
    ]);
  });
});
