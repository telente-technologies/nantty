import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpShareCardResolver } from "../../src/integrations/httpShareCardResolver.integration.js";
import { buildSharedContentCard } from "../../src/modules/messages/services/sharedContentCard.service.js";
import { contentQuerySchema, shareBodySchema } from "../../src/modules/messages/validators/messages.validator.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const orderId = "0192a4f0-0000-7000-8000-0000000000a1";
const buyerId = "0192a4f0-0000-7000-8000-0000000000b1";

describe("order share cards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts order references in shares and card lookups", () => {
    expect(contentQuerySchema.parse({ kind: "order", id: orderId })).toEqual({ kind: "order", id: orderId });
    expect(shareBodySchema.parse({ conversationIds: [orderId], reference: { kind: "order", id: orderId } }).reference.kind).toBe("order");
  });

  it("asks commerce for the card with the viewer, so only the buyer and that store's team see the summary", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: URL) => {
      seen.push(String(url));
      return url.searchParams.get("viewerId") === buyerId
        ? new Response(JSON.stringify({ availability: "available", title: "Order ZM-1042", subtitle: "3 items · shipped", imageUrl: null, priceLabel: "NGN 12,345.50" }), { status: 200 })
        : new Response("{}", { status: 404 });
    });
    const shareCards = createHttpShareCardResolver({ commerce: { baseUrl: "http://commerce.internal", internalToken: "t" }, live: undefined });
    const context = { shareCards, database: { client: {} }, directory: { findUserSummaries: async () => new Map() } } as unknown as HandlerContext;
    const forBuyer = await buildSharedContentCard(context, buyerId, { kind: "order", id: orderId });
    expect(forBuyer).toMatchObject({ availability: "available", title: "Order ZM-1042", priceLabel: "NGN 12,345.50", reference: { kind: "order", id: orderId } });
    const forStranger = await buildSharedContentCard(context, "0192a4f0-0000-7000-8000-0000000000c1", { kind: "order", id: orderId });
    expect(forStranger).toMatchObject({ availability: "unavailable", title: null, subtitle: null });
    expect(JSON.stringify(forStranger)).not.toMatch(/ZM-1042|NGN|items/);
    expect(seen[0]).toContain(`/api/v1/internal/share-cards/order/${orderId}?viewerId=${buyerId}`);
  });
});

describe("Space share cards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves a Space preview through the live service with viewer identity", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: URL) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ availability: "available", title: "Design talk", subtitle: "Ayo · host", imageUrl: null, isLive: true, status: "LIVE", viewerCount: 8 }), { status: 200 });
    });
    const shareCards = createHttpShareCardResolver({ commerce: undefined, live: { baseUrl: "http://live.internal", internalToken: "t" } });
    const context = { shareCards, database: { client: {} }, directory: { findUserSummaries: async () => new Map() } } as unknown as HandlerContext;
    const reference = { kind: "space", id: orderId } as const;
    expect(contentQuerySchema.parse(reference)).toEqual(reference);
    const card = await buildSharedContentCard(context, buyerId, reference);
    expect(card).toMatchObject({ availability: "available", title: "Design talk", isLive: true, viewerCount: 8, reference });
    expect(seen[0]).toContain(`/api/v1/internal/share-cards/space/${orderId}?viewerId=${buyerId}`);
  });
});
