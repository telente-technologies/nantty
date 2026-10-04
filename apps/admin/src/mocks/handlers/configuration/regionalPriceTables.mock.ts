import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { failNotFound, failValidation, readJsonObjectBody, readRequiredReason, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildInitialCoinPackRows, buildInitialPlanPriceRows, pricingRegions } from "@/mocks/seed/regionalPricing.mock";
import type { CoinPackPriceRow, PlanPriceRow, StoreProductKey } from "@/types/regionalPricing.type";

let planPriceRows: PlanPriceRow[] | null = null;
let coinPackRows: CoinPackPriceRow[] | null = null;

const readPlanPriceRows = () => (planPriceRows ??= buildInitialPlanPriceRows());
const readCoinPackRows = () => (coinPackRows ??= buildInitialCoinPackRows());
const storeProductKeys: readonly StoreProductKey[] = ["ios.month", "ios.year", "android.month", "android.year"];

function readAmount(body: Record<string, unknown>, key: string, minimum: number): number {
  const value = body[key] ?? 0;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > 1_000_000_000_000) failValidation(key, `Enter a whole amount in minor units (at least ${minimum}).`);
  return value;
}

function readStoreProductIds(value: unknown): Partial<Record<StoreProductKey, string>> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) failValidation("storeProductIds", "Use an object of store product ids.");
  const ids: Partial<Record<StoreProductKey, string>> = {};
  for (const [key, productId] of Object.entries(value as Record<string, unknown>)) {
    if (!storeProductKeys.includes(key as StoreProductKey) || typeof productId !== "string" || !/^[A-Za-z0-9._]{1,150}$/.test(productId)) failValidation(`storeProductIds.${key}`, "Use ios.month, ios.year, android.month or android.year with a valid product id.");
    ids[key as StoreProductKey] = productId;
  }
  return ids;
}

export function registerRegionalPriceTableMockHandlers(): void {
  registerMockRoute("GET", "/admin/subscriptions/price-table", (request) => {
    requireMockPermission(request, "config:read", "config:plans", "config:revenue");
    return respondWithJson(200, { data: readPlanPriceRows(), regions: pricingRegions, nextCursor: null });
  });

  registerMockRoute("PUT", "/admin/subscriptions/price-table/:planCode/:countryCode", (request) => {
    requireMockPermission(request, "config:plans");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const rows = readPlanPriceRows();
    const index = rows.findIndex((row) => row.planCode === request.params.planCode && row.countryCode === request.params.countryCode);
    if (index < 0) failNotFound("Plan price");
    const before = rows[index]!;
    if (body.currency !== before.currency) failValidation("currency", `Prices for ${before.countryCode} are in ${before.currency}.`);
    const monthlyAmountMinor = readAmount(body, "monthlyAmountMinor", 1);
    const yearlyAmountMinor = readAmount(body, "yearlyAmountMinor", 0);
    if (yearlyAmountMinor > monthlyAmountMinor * 12) failValidation("yearlyAmountMinor", "The yearly price can't cost more than twelve months.");
    const after: PlanPriceRow = {
      ...before, monthlyAmountMinor, yearlyAmountMinor,
      iosMonthlyAmountMinor: readAmount(body, "iosMonthlyAmountMinor", 0), iosYearlyAmountMinor: readAmount(body, "iosYearlyAmountMinor", 0),
      androidMonthlyAmountMinor: readAmount(body, "androidMonthlyAmountMinor", 0), androidYearlyAmountMinor: readAmount(body, "androidYearlyAmountMinor", 0),
      storeProductIds: readStoreProductIds(body.storeProductIds), active: body.active !== false, updatedByStaffId: request.principal?.adminId ?? "",
    };
    rows[index] = after;
    recordMockAuditEntry(request, { action: "pricing.plan_price.update", area: "config", target: { type: "planPrice", id: `${after.planCode}:${after.countryCode}`, label: `${after.planCode} in ${after.countryCode}` }, reason, before, after });
    return respondWithJson(200, after);
  });

  registerMockRoute("GET", "/admin/coins/price-table", (request) => {
    requireMockPermission(request, "config:read", "config:plans", "config:revenue");
    return respondWithJson(200, { data: readCoinPackRows(), nextCursor: null });
  });

  registerMockRoute("PUT", "/admin/coins/price-table/:packageId", (request) => {
    requireMockPermission(request, "config:revenue");
    requireMockStepUp(request);
    const body = readJsonObjectBody(request);
    const reason = readRequiredReason(body);
    const rows = readCoinPackRows();
    const index = rows.findIndex((row) => row.id === request.params.packageId);
    if (index < 0) failNotFound("Coin pack");
    const before = rows[index]!;
    const rawPrices = body.prices;
    if (typeof rawPrices !== "object" || rawPrices === null || Array.isArray(rawPrices)) failValidation("prices", "Give a price per currency.");
    const prices: Record<string, number> = {};
    for (const [currency, amount] of Object.entries(rawPrices as Record<string, unknown>)) {
      if (!pricingRegions.some((region) => region.currency === currency)) failValidation(`prices.${currency}`, "Use NGN, GHS, KES, ZAR, GBP, EUR or USD.");
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) failValidation(`prices.${currency}`, "Enter a whole amount above zero.");
      prices[currency] = amount;
    }
    const after: CoinPackPriceRow = { ...before, prices, coins: readAmount(body, "coins", 1), bonusCoins: readAmount(body, "bonusCoins", 0), active: body.active !== false };
    rows[index] = after;
    recordMockAuditEntry(request, { action: "pricing.coin_pack.update", area: "config", target: { type: "coinPack", id: after.id, label: after.name }, reason, before, after });
    return respondWithJson(200, after);
  });
}
