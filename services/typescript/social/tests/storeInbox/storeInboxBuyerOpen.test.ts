import { describe, expect, it } from "vitest";

import { openStoreConversationForBuyer } from "../../src/modules/storeInbox/commands/openStoreConversation/openStoreConversation.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const storeId = "0192a4f0-0000-7000-8000-00000000aaaa";
const buyerId = "0192a4f0-0000-7000-8000-00000000bbbb";

function context(card: { availability: string } | null, existing: unknown = null) {
  const created: unknown[] = [];
  const client = {
    block: { findFirst: async () => null, count: async () => 0 },
    conversation: {
      findUnique: async () => existing,
      create: async ({ data }: { data: Record<string, unknown> }) => (created.push(data), { id: "c-new", ...data, members: [] }),
    },
  };
  const handlerContext = { database: { client, transaction: async (run: (db: unknown) => Promise<unknown>) => run(client) }, shareCards: { resolve: async () => card } } as unknown as HandlerContext;
  return { handlerContext, created };
}

describe("a buyer opening a store chat", () => {
  it("refuses an id that is not a store, so ordinary accounts can't be pulled into business chats", async () => {
    const { handlerContext, created } = context({ availability: "unavailable" });
    await expect(openStoreConversationForBuyer(handlerContext, storeId, buyerId)).rejects.toMatchObject({ status: 404, code: "STORE_NOT_FOUND" });
    expect(created).toHaveLength(0);
  });

  it("fails closed when the store directory can't be reached", async () => {
    const { handlerContext, created } = context(null);
    await expect(openStoreConversationForBuyer(handlerContext, storeId, buyerId)).rejects.toMatchObject({ status: 503 });
    expect(created).toHaveLength(0);
  });

  it("creates the chat for a real store", async () => {
    const { handlerContext, created } = context({ availability: "available" });
    await expect(openStoreConversationForBuyer(handlerContext, storeId, buyerId)).resolves.toMatchObject({ id: "c-new", storeId });
    expect(created).toHaveLength(1);
  });

  it("reopens an existing store chat without another lookup", async () => {
    const existing = { id: "c-old", storeId, orderId: null, members: [] };
    const { handlerContext } = context(null, existing);
    await expect(openStoreConversationForBuyer(handlerContext, storeId, buyerId)).resolves.toMatchObject({ id: "c-old" });
  });
});
