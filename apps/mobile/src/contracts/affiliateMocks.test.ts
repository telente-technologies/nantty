import { resolveMockApiRequest } from "@/mocks";

import { c, validateAgainstContract } from "./contractSchema.util";

const money = c.object({ amountMinor: c.number(), currency: c.string() });
const affiliateStore = c.object({ id: c.string(), name: c.string(), logoUrl: c.nullable(c.string()) });
const affiliateAccess = c.string(["approved", "paused", "requested", "open", "approval_required", "closed"]);
const programmeTerms = c.object({ defaultCommissionPercent: c.number(), attributionWindowDays: c.number(), approval: c.string(["automatic", "manual"]), autoApproveFollowersAbove: c.nullable(c.number()), commissionPaidWhen: c.string(["order_completed"]) });
const affiliateLink = c.object({ id: c.string(), productId: c.string(), storeId: c.string(), path: c.string(), clicks: c.number(), createdAt: c.string() });
const promotableProduct = c.object({
  productId: c.string(), name: c.string(), imageUrl: c.nullable(c.string()), price: money, stock: c.nullable(c.number()), store: affiliateStore, commissionBasisPoints: c.number(), commissionPercent: c.number(),
  estimatedCommission: money, access: affiliateAccess, link: c.nullable(affiliateLink), programme: programmeTerms,
});
const affiliatePromotion = c.object({
  productId: c.string(), name: c.string(), imageUrl: c.nullable(c.string()), price: money, stock: c.nullable(c.number()), store: affiliateStore, commissionPercent: c.number(), access: affiliateAccess,
  link: c.nullable(affiliateLink), clicks: c.number(), pendingOrders: c.number(), completedOrders: c.number(), reversedOrders: c.number(), conversionPercent: c.nullable(c.number()), sales: money, earned: money,
  pendingEarnings: money, programme: c.nullable(programmeTerms),
});
const affiliateEarning = c.object({
  id: c.string(), status: c.string(["pending", "earned", "reversed"]), payoutStatus: c.string(["awaiting_completion", "waiting_for_seller_funds", "transferring", "paid", "reversed", "not_paid"]), reason: c.string(),
  orderNumber: c.string(), product: c.object({ id: c.string(), name: c.string() }), store: c.object({ id: c.string(), name: c.string() }), sale: money, commissionPercent: c.number(), commission: money, reversed: money,
  source: c.object({ source: c.string(), id: c.string() }), orderedAt: c.nullable(c.string()), decidedAt: c.nullable(c.string()), createdAt: c.string(),
});
const affiliateEarningsPage = c.object({ summary: c.object({ pending: c.array(money), earned: c.array(money), paid: c.array(money), reversed: c.array(money) }), data: c.array(affiliateEarning), nextCursor: c.nullable(c.string()) });
const linkClick = c.object({ productId: c.string(), attribution: c.object({ source: c.string(["post", "clip", "live", "link"]), id: c.string() }), attributionWindowDays: c.number(), expiresAt: c.string() });

describe("affiliate mocks match the creators module contracts", () => {
  it.each([
    ["GET", "/api/v1/creators/me/affiliate-catalog?sort=commission&limit=24", undefined, c.page(promotableProduct)],
    ["GET", "/api/v1/creators/me/affiliate-promotions", undefined, c.page(affiliatePromotion)],
    ["GET", "/api/v1/creators/me/affiliate-earnings?status=pending", undefined, affiliateEarningsPage],
    ["GET", "/api/v1/creators/me/affiliate-earnings?status=earned", undefined, affiliateEarningsPage],
    ["GET", "/api/v1/creators/me/affiliate-earnings?status=reversed", undefined, affiliateEarningsPage],
    ["POST", "/api/v1/creators/me/affiliate-links", { productId: "prod_dress" }, affiliateLink],
    ["POST", "/api/v1/affiliate-links/link_dress/clicks", {}, linkClick],
  ] as const)("%s %s", async (method, path, body, schema) => {
    const payload = await resolveMockApiRequest<unknown>(method, path, body);
    expect(validateAgainstContract(schema, payload)).toEqual([]);
  });

  it("refuses a link for a product that still needs the seller's approval", async () => {
    const failure = await resolveMockApiRequest("POST", "/api/v1/creators/me/affiliate-links", { productId: "prod_bag" }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status: 409, code: "AFFILIATION_PENDING" });
  });
});
