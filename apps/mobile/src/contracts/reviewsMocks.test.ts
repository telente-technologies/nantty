import { ApiError } from "@/errors/api.error";
import { resolveMockApiRequest } from "@/mocks";
import { productIdForKey } from "@/mocks/productCatalog.mock";
import { resetMockReviews, signedInBuyerReceivedProduct } from "@/mocks/reviews.mock";
import type { ProductRatingSummary, ProductReview, ProductReviewPage } from "@/types/commerce.type";
import { classifyReviewSubmitError } from "@/utils/productReviews.util";

jest.setTimeout(15000);

const delivered = productIdForKey("g6");
const notBought = productIdForKey("h6");

afterEach(() => resetMockReviews());

describe("reviews mock flow", () => {
  it("pages product reviews with a cursor", async () => {
    const first = await resolveMockApiRequest<ProductReviewPage>("GET", `/api/v1/products/${delivered}/reviews?limit=5`, undefined);
    expect(first.reviews).toHaveLength(5);
    expect(first.nextCursor).toBe("5");
    const second = await resolveMockApiRequest<ProductReviewPage>("GET", `/api/v1/products/${delivered}/reviews?limit=5&cursor=5`, undefined);
    expect(second.reviews[0]!.id).not.toBe(first.reviews[0]!.id);
    expect(first.reviews.every((review) => review.isVerifiedPurchase)).toBe(true);
  });

  it("lets an eligible buyer submit once, updates the summary, then reports already reviewed", async () => {
    expect(signedInBuyerReceivedProduct(delivered)).toBe(true);
    const before = await resolveMockApiRequest<ProductRatingSummary>("GET", `/api/v1/products/${delivered}/rating-summary`, undefined);
    const created = await resolveMockApiRequest<ProductReview>("POST", `/api/v1/products/${delivered}/reviews`, { rating: 2, text: " Strap broke " }, "key-1");
    expect(created.text).toBe("Strap broke");
    const after = await resolveMockApiRequest<ProductRatingSummary>("GET", `/api/v1/products/${delivered}/rating-summary`, undefined);
    expect(after.count).toBe(before.count + 1);
    expect(after.distribution["2"]).toBe(before.distribution["2"] + 1);
    const again = resolveMockApiRequest("POST", `/api/v1/products/${delivered}/reviews`, { rating: 5, text: "Again" }, "key-2");
    await expect(again).rejects.toBeInstanceOf(ApiError);
    await again.catch((error: unknown) => expect(classifyReviewSubmitError(error).outcome).toBe("already_reviewed"));
    await resolveMockApiRequest("DELETE", `/api/v1/reviews/${created.id}`, undefined);
    const restored = await resolveMockApiRequest<ProductRatingSummary>("GET", `/api/v1/products/${delivered}/rating-summary`, undefined);
    expect(restored.count).toBe(before.count);
  });

  it("refuses buyers without a delivered order", async () => {
    expect(signedInBuyerReceivedProduct(notBought)).toBe(false);
    const attempt = resolveMockApiRequest("POST", `/api/v1/products/${notBought}/reviews`, { rating: 5, text: "Nice" }, "key-3");
    await attempt.catch((error: unknown) => expect(classifyReviewSubmitError(error).outcome).toBe("not_eligible"));
    await expect(attempt).rejects.toBeInstanceOf(ApiError);
  });
});
