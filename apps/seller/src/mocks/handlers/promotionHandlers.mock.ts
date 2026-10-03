import { describeMockActor } from "@/mocks/handlers/settingsEntitlements.mock";
import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import {
  MockHttpError,
  createMockIdentifier,
  matchesSearchText,
  paginateMockList,
  readJsonObjectBody,
  requireMockStorePrincipal,
  respondWithError,
  respondWithJson,
  respondWithNoContent,
  respondWithValidationFailure,
} from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { Promotion } from "@/types/promotion.type";
import { calculateDiscountAmountMinor } from "@/utils/pricingRules.util";
import { derivePromotionStatusFromSchedule, validatePromotionInput, type PromotionInput } from "@/utils/promotionValidation.util";

function readNullableWholeNumber(value: unknown): number | null {
  return value === null || value === undefined || value === "" ? null : typeof value === "number" ? value : Number.NaN;
}

function readPromotionInput(body: Record<string, unknown>, existing: Promotion | null): PromotionInput {
  const discount = (body.discount ?? existing?.discount ?? {}) as { kind?: unknown; value?: unknown };
  const scope = (body.scope ?? existing?.scope ?? {}) as { kind?: unknown; ids?: unknown };
  const kind = (body.kind ?? existing?.kind) as Promotion["kind"];
  const rawCode = body.code !== undefined ? body.code : existing?.code;
  return {
    name: typeof body.name === "string" ? body.name : existing?.name ?? "",
    kind,
    code: kind === "coupon" && typeof rawCode === "string" ? rawCode.trim().toUpperCase() : null,
    discount: { kind: discount.kind === "amount" ? "amount" : "percent", value: typeof discount.value === "number" ? discount.value : Number.NaN },
    scope: {
      kind: scope.kind === "products" || scope.kind === "categories" ? scope.kind : "all",
      ids: Array.isArray(scope.ids) ? scope.ids.filter((id): id is string => typeof id === "string").slice(0, 200) : [],
    },
    minimumSpendMinor: "minimumSpendMinor" in body ? readNullableWholeNumber(body.minimumSpendMinor) : existing?.minimumSpend?.amountMinor ?? null,
    usageLimit: "usageLimit" in body ? readNullableWholeNumber(body.usageLimit) : existing?.usageLimit ?? null,
    usageLimitPerCustomer: "usageLimitPerCustomer" in body ? readNullableWholeNumber(body.usageLimitPerCustomer) : existing?.usageLimitPerCustomer ?? null,
    startsAt: typeof body.startsAt === "string" ? body.startsAt : existing?.startsAt ?? "",
    endsAt: "endsAt" in body ? (typeof body.endsAt === "string" && body.endsAt !== "" ? body.endsAt : null) : existing?.endsAt ?? null,
  };
}

function convertInputToPromotionFields(input: PromotionInput, usedCount: number) {
  const currency = readMockDatabase().settings.currency;
  const fields = {
    name: input.name.trim(),
    kind: input.kind,
    code: input.code,
    discount: input.discount,
    scope: input.scope.kind === "all" ? { kind: "all" as const, ids: [] } : input.scope,
    minimumSpend: input.minimumSpendMinor === null ? null : { amountMinor: input.minimumSpendMinor, currency },
    usageLimit: input.usageLimit,
    usageLimitPerCustomer: input.usageLimitPerCustomer,
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : null,
  };
  return { ...fields, status: derivePromotionStatusFromSchedule({ ...fields, usedCount }) };
}

function assertCouponCodeIsUnique(code: string | null, ignoredPromotionId: string | null): void {
  if (!code) return;
  if (readMockDatabase().promotions.some((promotion) => promotion.id !== ignoredPromotionId && promotion.code === code)) {
    throw new MockHttpError(409, "COUPON_CODE_TAKEN", `The code ${code} is already used by another promotion.`);
  }
}

function findPromotionIndexOrThrow(promotionId: string): number {
  const promotionIndex = readMockDatabase().promotions.findIndex((promotion) => promotion.id === promotionId);
  if (promotionIndex < 0) throw new MockHttpError(404, "PROMOTION_NOT_FOUND", "That promotion does not exist in your store.");
  return promotionIndex;
}

function refreshPromotionStatuses(): Promotion[] {
  const database = readMockDatabase();
  database.promotions = database.promotions.map((promotion) => (promotion.status === "disabled" ? promotion : { ...promotion, status: derivePromotionStatusFromSchedule(promotion) }));
  return database.promotions;
}

function registerCouponValidationHandler(): void {
  registerMockRoute("POST", "/seller/promotions/validate-code", (request) => {
    requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const subtotalMinor = body.subtotalMinor;
    if (!code || typeof subtotalMinor !== "number" || !Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
      return respondWithValidationFailure([{ path: "code", message: "Send a code and a whole-number subtotal." }]);
    }
    const promotion = refreshPromotionStatuses().find((candidate) => candidate.kind === "coupon" && candidate.code === code);
    if (!promotion) return respondWithError(404, "COUPON_NOT_FOUND", `There is no coupon called ${code}.`);
    const notApplicable = (message: string) => respondWithError(422, "COUPON_NOT_APPLICABLE", message);
    if (promotion.status === "disabled") return notApplicable(`${code} has been switched off.`);
    if (promotion.status === "scheduled") return notApplicable(`${code} starts on ${new Date(promotion.startsAt).toLocaleDateString("en-NG")}.`);
    if (promotion.status === "expired") return notApplicable(`${code} has expired or reached its usage limit.`);
    if (promotion.minimumSpend && subtotalMinor < promotion.minimumSpend.amountMinor) return notApplicable(`${code} needs a minimum spend before it applies.`);
    const discountMinor = calculateDiscountAmountMinor(subtotalMinor, promotion.discount);
    return respondWithJson(200, {
      promotionId: promotion.id,
      code,
      discount: promotion.discount,
      scope: promotion.scope,
      discountMinor,
      message: promotion.scope.kind === "all" ? `${promotion.name} applied.` : `${promotion.name} applies to eligible items only.`,
    });
  });
}

export function registerPromotionMockHandlers(): void {
  registerCouponValidationHandler();

  registerMockRoute("GET", "/seller/promotions", (request) => {
    requireMockStorePrincipal(request);
    const status = request.query.get("status");
    const kind = request.query.get("kind");
    const promotions = refreshPromotionStatuses().filter((promotion) => (!status || status === "all" || promotion.status === status) && (!kind || kind === "all" || promotion.kind === kind) && matchesSearchText(request.query.get("q"), promotion.name, promotion.code));
    return respondWithJson(200, paginateMockList(promotions, request.query, 50));
  });

  registerMockRoute("POST", "/seller/promotions", (request) => {
    const principal = requireMockStorePrincipal(request);
    const input = readPromotionInput(readJsonObjectBody(request), null);
    const issues = validatePromotionInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    assertCouponCodeIsUnique(input.code, null);
    const promotion: Promotion = { id: createMockIdentifier("promo"), ...convertInputToPromotionFields(input, 0), usedCount: 0, createdAt: new Date().toISOString() };
    readMockDatabase().promotions.unshift(promotion);
    appendMockAuditLogEntry({ actor: describeMockActor(principal), action: "promotion.created", targetType: "promotion", targetId: promotion.id, summary: `Created promotion ${promotion.name}` });
    return respondWithJson(201, promotion);
  });

  registerMockRoute("GET", "/seller/promotions/:promotionId", (request) => {
    requireMockStorePrincipal(request);
    return respondWithJson(200, refreshPromotionStatuses()[findPromotionIndexOrThrow(request.params.promotionId ?? "")]);
  });

  registerMockRoute("PATCH", "/seller/promotions/:promotionId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const promotionIndex = findPromotionIndexOrThrow(request.params.promotionId ?? "");
    const existing = database.promotions[promotionIndex] as Promotion;
    const body = readJsonObjectBody(request);
    const input = readPromotionInput(body, existing);
    const issues = validatePromotionInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    assertCouponCodeIsUnique(input.code, existing.id);
    const recomputed = convertInputToPromotionFields(input, existing.usedCount);
    const status = body.status === "disabled" ? "disabled" : body.status === "active" || existing.status !== "disabled" ? recomputed.status : "disabled";
    const updated: Promotion = { ...existing, ...recomputed, status };
    database.promotions[promotionIndex] = updated;
    appendMockAuditLogEntry({ actor: describeMockActor(principal), action: "promotion.updated", targetType: "promotion", targetId: updated.id, summary: `${status === "disabled" ? "Switched off" : "Updated"} promotion ${updated.name}` });
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/promotions/:promotionId", (request) => {
    const principal = requireMockStorePrincipal(request);
    const database = readMockDatabase();
    const promotionIndex = findPromotionIndexOrThrow(request.params.promotionId ?? "");
    const [removed] = database.promotions.splice(promotionIndex, 1);
    appendMockAuditLogEntry({ actor: describeMockActor(principal), action: "promotion.deleted", targetType: "promotion", targetId: removed?.id ?? null, summary: `Deleted promotion ${removed?.name ?? ""}` });
    return respondWithNoContent();
  });
}
