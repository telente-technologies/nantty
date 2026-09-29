import { ForbiddenError } from "@zudojs/errors";
import { createEventBus } from "@zudojs/events";
import { describe, expect, it } from "vitest";

import type { ProductCatalog } from "../../../src/interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../src/interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../../../src/interfaces/userDirectory.interface.js";
import { CreateReviewCommand } from "../../../src/modules/reviews/commands/createReview/createReview.command.js";
import { CreateReviewHandler } from "../../../src/modules/reviews/commands/createReview/createReview.handler.js";
import { DeleteReviewCommand } from "../../../src/modules/reviews/commands/deleteReview/deleteReview.command.js";
import { DeleteReviewHandler } from "../../../src/modules/reviews/commands/deleteReview/deleteReview.handler.js";
import { ReplyToReviewCommand } from "../../../src/modules/reviews/commands/replyToReview/replyToReview.command.js";
import { ReplyToReviewHandler } from "../../../src/modules/reviews/commands/replyToReview/replyToReview.handler.js";
import { InMemoryReviewsRepository } from "../../../src/modules/reviews/repositories/reviews.repository.js";
import { ReviewsService } from "../../../src/modules/reviews/services/reviews.service.js";

const buyer = { userId: "buyer-1", roles: ["buyer"], sessionId: "session-1" };
const otherBuyer = { userId: "buyer-2", roles: ["buyer"], sessionId: "session-2" };
const seller = { userId: "seller-1", roles: ["seller"], sessionId: "session-3" };

function createReviewsHarness() {
  const productRatings = new Map<string, { average: number; count: number }>();
  const storeRatings = new Map<string, { average: number; count: number }>();
  const receivedOrders = new Set(["buyer-1:order-1:product-1", "buyer-1:order-2:product-1", "buyer-2:order-3:product-1"]);
  const productCatalog = {
    updateProductRating: async (productId: string, average: number, count: number) => void productRatings.set(productId, { average, count }),
  } as unknown as ProductCatalog;
  const storeAccess = {
    updateStoreRating: async (storeId: string, average: number, count: number) => void storeRatings.set(storeId, { average, count }),
    findStoreSummaries: async () => [{ id: "store-1", ownerId: "seller-1" }],
    assertStoreMember: async (userId: string) => {
      if (userId !== "seller-1") throw new ForbiddenError("Not a member.");
    },
  } as unknown as StoreAccess;
  const userDirectory = { findUserSummaries: async () => [] } as unknown as UserDirectory;
  const service = new ReviewsService({
    reviews: new InMemoryReviewsRepository(),
    orderLookup: {
      hasReceivedProductInOrder: async (buyerId, orderId, productId) =>
        receivedOrders.has(`${buyerId}:${orderId}:${productId}`) ? { storeId: "store-1" } : undefined,
      findReceivedOrderForProduct: async (buyerId, productId) => {
        const match = [...receivedOrders].find((key) => key.startsWith(`${buyerId}:`) && key.endsWith(`:${productId}`));
        return match === undefined ? undefined : { orderId: match.split(":")[1] ?? "", storeId: "store-1" };
      },
      listStoreIdsBuyerHasPurchasedFrom: async () => [],
      listAttributedOrderItems: async () => [],
    },
    productCatalog,
    storeAccess,
    userDirectory,
    events: createEventBus(),
    clock: { now: () => new Date("2026-09-10T12:00:00.000Z") },
  });
  return { service, productRatings, storeRatings };
}

describe("reviews", () => {
  it("lets a buyer who received the product review it once per order and updates ratings", async () => {
    const { service, productRatings, storeRatings } = createReviewsHarness();
    const create = new CreateReviewHandler(service);
    await create.execute(new CreateReviewCommand(buyer, "product-1", { orderId: "order-1", rating: 5, text: "Great" }));
    await create.execute(new CreateReviewCommand(otherBuyer, "product-1", { orderId: "order-3", rating: 2 }));
    expect(productRatings.get("product-1")).toEqual({ average: 3.5, count: 2 });
    expect(storeRatings.get("store-1")).toEqual({ average: 3.5, count: 2 });
    await expect(create.execute(new CreateReviewCommand(buyer, "product-1", { orderId: "order-1", rating: 4 }))).rejects.toMatchObject({ statusCode: 409 });
    const summary = await service.dependencies.reviews.summarize({ productId: "product-1" });
    expect(summary.distribution).toEqual({ "1": 0, "2": 1, "3": 0, "4": 0, "5": 1 });
  });

  it("rejects buyers who did not receive the product in that order", async () => {
    const { service } = createReviewsHarness();
    const create = new CreateReviewHandler(service);
    await expect(create.execute(new CreateReviewCommand(otherBuyer, "product-1", { orderId: "order-1", rating: 5 }))).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows only store members to reply and only authors to delete", async () => {
    const { service, productRatings } = createReviewsHarness();
    const review = await new CreateReviewHandler(service).execute(new CreateReviewCommand(buyer, "product-1", { orderId: "order-2", rating: 4 }));
    const reply = new ReplyToReviewHandler(service);
    await expect(reply.execute(new ReplyToReviewCommand(otherBuyer, review.id, "Hi"))).rejects.toMatchObject({ statusCode: 403 });
    expect((await reply.execute(new ReplyToReviewCommand(seller, review.id, "Thank you!"))).reply).toBe("Thank you!");
    const remove = new DeleteReviewHandler(service);
    await expect(remove.execute(new DeleteReviewCommand(otherBuyer, review.id))).rejects.toMatchObject({ statusCode: 403 });
    await remove.execute(new DeleteReviewCommand(buyer, review.id));
    expect(productRatings.get("product-1")).toEqual({ average: 0, count: 0 });
  });
});
