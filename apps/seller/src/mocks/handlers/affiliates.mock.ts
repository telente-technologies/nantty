import { buildCommissionLedgerEntries, buildCreatorPerformanceRows, buildStoreMoneyForAffiliates, findEffectiveCommissionBasisPointsForProduct, isValidAffiliateCommissionBasisPoints, readAffiliatesMockState, recordAffiliateAuditEntry } from "@/mocks/affiliateLedger.mock";
import { registerAffiliateLiveInvitationMockHandlers } from "@/mocks/handlers/affiliateLiveInvitations.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, matchesSearchText, paginateMockList, readDateRangeFromQuery, readJsonObjectBody, requireMockStorePrincipal, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { AffiliateOverview, AffiliateProgramSettings } from "@/types/affiliate.type";
import { calculateBasisPointsShareOfMinorAmount } from "@/utils/money.util";

function validateAffiliateSettingsPatch(body: Record<string, unknown>): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if ("enabled" in body && typeof body.enabled !== "boolean") issues.push({ path: "enabled", message: "Program on/off must be true or false." });
  if ("defaultCommissionBasisPoints" in body && !isValidAffiliateCommissionBasisPoints(body.defaultCommissionBasisPoints)) issues.push({ path: "defaultCommissionBasisPoints", message: "Default commission must be between 0% and 50%." });
  const threshold = body.autoApproveCreatorsWithFollowersAbove;
  if ("autoApproveCreatorsWithFollowersAbove" in body && threshold !== null && !(typeof threshold === "number" && Number.isInteger(threshold) && threshold >= 0 && threshold <= 100_000_000)) issues.push({ path: "autoApproveCreatorsWithFollowersAbove", message: "Follower threshold must be a whole number or empty." });
  const cookieWindowDays = body.cookieWindowDays;
  if ("cookieWindowDays" in body && !(typeof cookieWindowDays === "number" && Number.isInteger(cookieWindowDays) && cookieWindowDays >= 1 && cookieWindowDays <= 90)) issues.push({ path: "cookieWindowDays", message: "Attribution window must be 1 to 90 days." });
  return issues;
}

function registerAffiliateProgramMockHandlers(): void {
  registerMockRoute("GET", "/seller/affiliates/settings", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, readAffiliatesMockState().settings);
  });

  registerMockRoute("PATCH", "/seller/affiliates/settings", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const issues = validateAffiliateSettingsPatch(body);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const state = readAffiliatesMockState();
    const nextSettings: AffiliateProgramSettings = {
      enabled: typeof body.enabled === "boolean" ? body.enabled : state.settings.enabled,
      defaultCommissionBasisPoints: typeof body.defaultCommissionBasisPoints === "number" ? body.defaultCommissionBasisPoints : state.settings.defaultCommissionBasisPoints,
      autoApproveCreatorsWithFollowersAbove: "autoApproveCreatorsWithFollowersAbove" in body ? (body.autoApproveCreatorsWithFollowersAbove as number | null) : state.settings.autoApproveCreatorsWithFollowersAbove,
      cookieWindowDays: typeof body.cookieWindowDays === "number" ? body.cookieWindowDays : state.settings.cookieWindowDays,
    };
    state.settings = nextSettings;
    recordAffiliateAuditEntry(request, "affiliates.settings_updated", `Set default creator commission to ${nextSettings.defaultCommissionBasisPoints / 100}%${nextSettings.enabled ? "" : " (program off)"}`, null);
    return respondWithJson(200, nextSettings);
  });

  registerMockRoute("GET", "/seller/affiliates/overview", (request) => {
    requireMockStorePrincipal(request);
    const state = readAffiliatesMockState();
    const ledger = buildCommissionLedgerEntries().filter((entry) => entry.status !== "reversed");
    const performanceRows = buildCreatorPerformanceRows(null);
    const overview: AffiliateOverview = {
      settings: state.settings,
      creatorDrivenSales: buildStoreMoneyForAffiliates(ledger.reduce((sum, entry) => sum + entry.orderTotal.amountMinor, 0)),
      commissionsOwed: buildStoreMoneyForAffiliates(ledger.filter((entry) => entry.status === "owed").reduce((sum, entry) => sum + entry.commission.amountMinor, 0)),
      commissionsPaid: buildStoreMoneyForAffiliates(ledger.filter((entry) => entry.status === "paid").reduce((sum, entry) => sum + entry.commission.amountMinor, 0)),
      activeCreatorsCount: performanceRows.filter((row) => row.status === "active").length,
      pendingRequestsCount: state.requests.filter((affiliateRequest) => affiliateRequest.status === "pending").length,
      topCreators: performanceRows.slice(0, 5),
    };
    return respondWithJson(200, overview);
  });
}

function registerAffiliateRequestAndCreatorMockHandlers(): void {
  registerMockRoute("GET", "/seller/affiliates/requests", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const requests = readAffiliatesMockState().requests.filter((affiliateRequest) => !status || affiliateRequest.status === status);
    return respondWithJson(200, paginateMockList(requests, request.query));
  });

  for (const decision of ["approve", "decline"] as const) {
    registerMockRoute("POST", `/seller/affiliates/requests/:requestId/${decision}`, (request) => {
      requireMockStorePrincipal(request);
      const state = readAffiliatesMockState();
      const requestIndex = state.requests.findIndex((candidate) => candidate.id === request.params.requestId);
      const affiliateRequest = state.requests[requestIndex];
      if (!affiliateRequest) throw new MockHttpError(404, "REQUEST_NOT_FOUND", "That request no longer exists.");
      if (affiliateRequest.status !== "pending") throw new MockHttpError(409, "REQUEST_ALREADY_DECIDED", "This request was already answered.");
      const reasonValue = (request.jsonBody as { reason?: unknown } | undefined)?.reason;
      const reason = typeof reasonValue === "string" && reasonValue.trim() ? reasonValue.trim() : null;
      if (reason && reason.length > 300) return respondWithValidationFailure([{ path: "reason", message: "Keep the reason under 300 characters." }]);
      const updatedRequest = { ...affiliateRequest, status: decision === "approve" ? ("approved" as const) : ("declined" as const), decisionReason: reason };
      state.requests[requestIndex] = updatedRequest;
      if (decision === "approve") state.approvedCreators.set(affiliateRequest.creator.id, { status: "active", clicks: 0, approvedAt: new Date().toISOString() });
      recordAffiliateAuditEntry(request, `affiliates.request_${decision}d`, `${decision === "approve" ? "Approved" : "Declined"} @${affiliateRequest.creator.username} as an affiliate`, affiliateRequest.id);
      return respondWithJson(200, updatedRequest);
    });
  }

  registerMockRoute("GET", "/seller/affiliates/creators", (request) => {
    requireMockStorePrincipal(request);
    const range = request.query.get("from") || request.query.get("to") ? readDateRangeFromQuery(request.query) : null;
    return respondWithJson(200, { data: buildCreatorPerformanceRows(range), nextCursor: null });
  });

  registerMockRoute("PATCH", "/seller/affiliates/creators/:creatorId", (request) => {
    requireMockStorePrincipal(request);
    const status = readJsonObjectBody(request).status;
    if (status !== "active" && status !== "paused") return respondWithValidationFailure([{ path: "status", message: "Status must be active or paused." }]);
    const membership = readAffiliatesMockState().approvedCreators.get(request.params.creatorId ?? "");
    if (!membership) throw new MockHttpError(404, "CREATOR_NOT_FOUND", "This creator is not in your program.");
    membership.status = status;
    recordAffiliateAuditEntry(request, "affiliates.creator_status_changed", `${status === "paused" ? "Paused" : "Resumed"} creator ${request.params.creatorId}`, request.params.creatorId ?? null);
    return respondWithJson(200, buildCreatorPerformanceRows(null).find((row) => row.creator.id === request.params.creatorId));
  });

  registerMockRoute("DELETE", "/seller/affiliates/creators/:creatorId", (request) => {
    requireMockStorePrincipal(request);
    const state = readAffiliatesMockState();
    if (!state.approvedCreators.delete(request.params.creatorId ?? "")) throw new MockHttpError(404, "CREATOR_NOT_FOUND", "This creator is not in your program.");
    recordAffiliateAuditEntry(request, "affiliates.creator_removed", `Removed creator ${request.params.creatorId} from the program`, request.params.creatorId ?? null);
    return respondWithNoContent();
  });
}

function registerAffiliateCommissionMockHandlers(): void {
  registerMockRoute("GET", "/seller/affiliates/product-commissions", (request) => {
    requireMockStorePrincipal(request);
    const state = readAffiliatesMockState();
    const rows = readMockDatabase()
      .products.filter((product) => product.status !== "archived" && product.publishedOnline && matchesSearchText(request.query.get("q"), product.name))
      .map((product) => {
        const override = state.productOverrides.get(product.id);
        const price = product.variants[0]?.price ?? buildStoreMoneyForAffiliates(0);
        const effectiveBasisPoints = findEffectiveCommissionBasisPointsForProduct(product.id) ?? 0;
        return { productId: product.id, productName: product.name, imageUrl: product.images[0]?.url ?? null, price, commissionBasisPoints: override?.commissionBasisPoints ?? null, excluded: override?.excluded ?? false, estimatedCommission: buildStoreMoneyForAffiliates(calculateBasisPointsShareOfMinorAmount(price.amountMinor, effectiveBasisPoints)) };
      });
    return respondWithJson(200, paginateMockList(rows, request.query, 100));
  });

  registerMockRoute("PUT", "/seller/affiliates/product-commissions/:productId", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const product = readMockDatabase().products.find((candidate) => candidate.id === request.params.productId);
    if (!product) throw new MockHttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const basisPoints = body.commissionBasisPoints ?? null;
    if (basisPoints !== null && !isValidAffiliateCommissionBasisPoints(basisPoints)) return respondWithValidationFailure([{ path: "commissionBasisPoints", message: "Commission must be between 0% and 50%, or empty to use the default." }]);
    if ("excluded" in body && typeof body.excluded !== "boolean") return respondWithValidationFailure([{ path: "excluded", message: "Excluded must be true or false." }]);
    const state = readAffiliatesMockState();
    const excluded = typeof body.excluded === "boolean" ? body.excluded : state.productOverrides.get(product.id)?.excluded ?? false;
    state.productOverrides.set(product.id, { commissionBasisPoints: basisPoints as number | null, excluded });
    recordAffiliateAuditEntry(request, "affiliates.product_commission_set", `${excluded ? "Excluded" : "Set commission for"} ${product.name}${excluded || basisPoints === null ? "" : ` to ${(basisPoints as number) / 100}%`}`, product.id);
    return respondWithJson(200, { productId: product.id, commissionBasisPoints: basisPoints, excluded });
  });

  registerMockRoute("GET", "/seller/affiliates/commission-ledger", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const entries = buildCommissionLedgerEntries().filter((entry) => !status || entry.status === status);
    return respondWithJson(200, paginateMockList(entries, request.query));
  });
}

export function registerAffiliatesMockHandlers(): void {
  registerAffiliateProgramMockHandlers();
  registerAffiliateRequestAndCreatorMockHandlers();
  registerAffiliateCommissionMockHandlers();
  registerAffiliateLiveInvitationMockHandlers();
}
