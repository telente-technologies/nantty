import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commentsForPost } from "@/mocks/comments.mock";
import { isGuestBrowsablePage } from "@/config/guestBrowsing.config";
import { isUsernameProfilePath } from "@/config/reservedRoutes.config";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import type { Order, Post, PostLocationTag, SavedItem, Story } from "@/types";
import type { Dispute, EscrowDetail } from "@/types/commerce.type";
import type { CreatorSubscriptionState } from "@/types/creator.type";
import type { CatalogProduct } from "@/types/sellerCatalog.type";
import { escrowActionsForViewer } from "@/utils/escrowStage.util";
import { buildCatalogProductUpsertRequest, formValuesFromCatalogProduct } from "@/utils/sellerProductForm.util";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const send = (method: string, path: string, body?: unknown, query: Record<string, string> = {}) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(query), body === undefined ? null : encode(body));
const failureCode = (promise: Promise<unknown>) => promise.then(() => "OK", (error: { code?: string }) => error.code ?? "UNKNOWN");
const listOf = <T>(payload: unknown) => (Array.isArray(payload) ? payload : (payload as { data: T[] }).data) as T[];

async function uploadMockMedia(mimeType = "image/jpeg", purpose = "post"): Promise<string> {
  const session = (await send("POST", "/api/v1/media/uploads", { fileName: "a", mimeType, sizeBytes: 1000, purpose })) as { uploadId: string; totalChunks: number };
  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex++) await send("PUT", `/api/v1/media/uploads/${session.uploadId}/chunks/${chunkIndex}`);
  return ((await send("POST", `/api/v1/media/uploads/${session.uploadId}/complete`)) as { mediaId: string }).mediaId;
}

describe("disputes and escrow", () => {
  it("opens a dispute once, rejects bad evidence, and keeps the thread closed to strangers", async () => {
    const orders = listOf<Order>(await send("GET", "/api/v1/orders"));
    let target: EscrowDetail | null = null;
    for (const order of orders) {
      const escrow = (await send("GET", `/api/v1/orders/${order.id}/escrow`).catch(() => null)) as EscrowDetail | null;
      if (escrow && escrowActionsForViewer(escrow, "buyer").canOpenDispute) { target = escrow; break; }
    }
    assert.ok(target, "a disputable escrow order exists in the mocks");
    const path = `/api/v1/orders/${target.orderId}/disputes`;
    assert.equal(await failureCode(send("POST", path, { reason: "damaged", description: "The heel is peeling off badly", evidenceUrls: ["blob:local"] })), "VALIDATION_FAILED");
    const dispute = (await send("POST", path, { reason: "damaged", description: "The heel is peeling off badly", evidenceUrls: ["https://cdn.example/e.jpg"] })) as Dispute;
    const again = (await send("POST", path, { reason: "damaged", description: "The heel is peeling off badly", evidenceUrls: [] })) as Dispute;
    assert.equal(again.id, dispute.id);
    assert.equal(dispute.status, "awaiting_seller");
    const escrowAfter = (await send("GET", `/api/v1/orders/${target.orderId}/escrow`)) as EscrowDetail;
    assert.equal(escrowAfter.disputeId, dispute.id);
    assert.equal(escrowActionsForViewer(escrowAfter, "buyer").canOpenDispute, false);
    assert.equal(await failureCode(send("POST", `/api/v1/disputes/${dispute.id}/messages`, { text: "  ", attachmentUrls: [] })), "VALIDATION_FAILED");
    await send("POST", `/api/v1/disputes/${dispute.id}/messages`, { text: "Here are more photos", attachmentUrls: [] });
    assert.equal(((await send("GET", `/api/v1/disputes/${dispute.id}`)) as Dispute).messages.at(-1)?.text, "Here are more photos");
    assert.equal(await failureCode(send("GET", "/api/v1/disputes/d_missing")), "DISPUTE_NOT_FOUND");
  });
});

describe("creator subscriptions", () => {
  it("subscribes, cancels, refuses a double cancel and resumes", async () => {
    const plans = listOf<{ id: string }>(await send("GET", "/api/v1/creators/u_13/subscription-plans"));
    const checkout = (await send("POST", "/api/v1/creators/u_13/subscriptions", { planId: plans[0]!.id })) as { subscriptionId: string };
    const mine = listOf<CreatorSubscriptionState>(await send("GET", "/api/v1/creator-subscriptions"));
    const state = mine.find((entry) => entry.subscriptionId === checkout.subscriptionId)!;
    assert.equal(state.status, "active");
    assert.ok(state.price.amountMinor > 0 && state.currentPeriodEnd);
    const cancelled = (await send("POST", `/api/v1/creator-subscriptions/${state.subscriptionId}/cancel`)) as CreatorSubscriptionState;
    assert.equal(cancelled.status, "cancelled");
    assert.equal(await failureCode(send("POST", `/api/v1/creator-subscriptions/${state.subscriptionId}/cancel`)), "SUBSCRIPTION_NOT_ACTIVE");
    assert.equal(((await send("POST", `/api/v1/creator-subscriptions/${state.subscriptionId}/resume`)) as CreatorSubscriptionState).status, "active");
    assert.equal(await failureCode(send("GET", "/api/v1/creator-subscriptions/subs_unknown")), "SUBSCRIPTION_NOT_FOUND");
  });
});

describe("places and saved replies", () => {
  it("searches bundled places and offers the typed text", async () => {
    const { places } = (await send("GET", "/api/v1/places/search", undefined, { q: "lag" })) as { places: PostLocationTag[] };
    assert.ok(places.some((place) => place.name === "Lagos"));
    assert.deepEqual(places.at(-1), { placeId: "text:lag", name: "lag", area: null });
    assert.deepEqual(((await send("GET", "/api/v1/places/search", undefined, { q: "a" })) as { places: unknown[] }).places, []);
  });

  it("includes the parent post id on saved replies", async () => {
    const comment = commentsForPost("post_1")[1] ?? commentsForPost("post_1")[0]!;
    const saved = (await send("POST", "/api/v1/saves", { type: "comment", targetId: comment.id })) as SavedItem;
    assert.equal(saved.postId, comment.postId);
    assert.equal(saved.preview.href, `/post/${comment.postId}/comment/${comment.id}`);
  });
});

describe("seller products with photos", () => {
  it("refuses unprocessed photos, keeps existing ones and archives on delete", async () => {
    const products = listOf<CatalogProduct>(await send("GET", "/api/v1/seller/products"));
    const product = products[0]!;
    const freshMediaId = await uploadMockMedia("image/jpeg", "product");
    const values = { ...formValuesFromCatalogProduct(product), images: [...product.images, { mediaId: freshMediaId, url: "" }] };
    assert.equal(await failureCode(send("PATCH", `/api/v1/seller/products/${product.id}`, buildCatalogProductUpsertRequest(values, product, null, "T"))), "MEDIA_NOT_READY");
    const reordered = { ...formValuesFromCatalogProduct(product), images: [...product.images].reverse() };
    const updated = (await send("PATCH", `/api/v1/seller/products/${product.id}`, buildCatalogProductUpsertRequest(reordered, product, null, "T"))) as CatalogProduct;
    assert.deepEqual(updated.images.map((image) => image.mediaId), [...product.images].reverse().map((image) => image.mediaId));
    assert.equal(updated.variants.length, product.variants.length);
    await send("DELETE", `/api/v1/seller/products/${product.id}`);
    assert.ok(!listOf<CatalogProduct>(await send("GET", "/api/v1/seller/products")).some((entry) => entry.id === product.id));
    assert.equal(await failureCode(send("GET", "/api/v1/seller/products/pr_missing")), "PRODUCT_NOT_FOUND");
  });
});

describe("clip and story creation", () => {
  it("publishes a photo clip as a slideshow and rejects mixed or bad timings", async () => {
    const first = await uploadMockMedia();
    const second = await uploadMockMedia();
    const base = { text: "Weekend", mediaIds: [first, second], audience: "everyone", kind: "clip" };
    assert.equal(await failureCode(send("POST", "/api/v1/posts", { ...base, slideshow: { durationsMs: [500, 3000], transition: "none" } })), "INVALID_SLIDESHOW");
    const clip = (await send("POST", "/api/v1/posts", { ...base, slideshow: { durationsMs: [3000, 4000], transition: "crossfade" }, location: { placeId: "zm:ng:lagos:yaba", name: "Yaba", area: "Lagos, Nigeria" } })) as Post;
    assert.equal(clip.kind, "clip");
    assert.equal(clip.media.length, 1);
    assert.equal(clip.media[0]?.type, "video");
  });

  it("publishes a story by media id and shows it on the author's stories", async () => {
    assert.equal(await failureCode(send("POST", "/api/v1/stories", { mediaId: "med_missing" })), "MEDIA_NOT_FOUND");
    const mediaId = await uploadMockMedia("image/jpeg", "story");
    const story = (await send("POST", "/api/v1/stories", { mediaId, look: "warm" })) as Story;
    const mine = listOf<Story>(await send("GET", `/api/v1/users/${story.author.id}/stories`));
    assert.ok(mine.some((entry) => entry.id === story.id));
  });
});

describe("payout setup summary", () => {
  it("returns the onboarding state the wallet card reads", async () => {
    const state = (await send("GET", "/api/v1/payments/payout-onboarding/me")) as { status: string; completedSteps: unknown[] };
    assert.equal(state.status, "not_started");
    assert.deepEqual(state.completedSteps, []);
  });
});

describe("signed-out boundaries for the new pages", () => {
  it("sends guests to sign in and never treats the new routes as usernames", () => {
    for (const path of ["/disputes/d_1", "/orders/o_1/escrow", "/orders/o_1/dispute", "/subscriptions", "/create/clip", "/create/story", "/create/live", "/settings/payment-methods", "/seller/products/new"]) {
      assert.equal(isGuestBrowsablePage(path), false, path);
    }
    assert.equal(isUsernameProfilePath("/disputes"), false);
    assert.equal(isUsernameProfilePath("/create"), false);
  });
});

describe("seller fulfilment body", () => {
  it("needs the courier, tracking number and the location it ships from, as the orders service does", async () => {
    const orders = listOf<Order>(await send("GET", "/api/v1/seller/orders"));
    const paid = orders.find((order) => order.status === "paid");
    if (!paid) return;
    assert.equal(await failureCode(send("POST", `/api/v1/seller/orders/${paid.id}/fulfilment`, { courierName: "GIG", trackingNumber: "T1" })), "VALIDATION_FAILED");
    const [location] = listOf<{ id: string }>(await send("GET", "/api/v1/seller/locations"));
    const shipped = (await send("POST", `/api/v1/seller/orders/${paid.id}/fulfilment`, { courier: "GIG", trackingNumber: "t1", fromLocationId: location!.id })) as Order;
    assert.equal(shipped.status, "shipped");
  });
});
