import { deriveTimeBoxedCampaignStatus, findMarketingProductOptionOrThrow, readMarketingState, requireMarketingPlanFeature } from "@/mocks/handlers/marketingState.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { createMockIdentifier, MockHttpError, paginateMockList, readJsonObjectBody, respondWithJson, respondWithNoContent, respondWithValidationFailure } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { FlashSale, FlashSaleInput, ProductBundle, ProductBundleInput } from "@/types/marketing.type";
import { validateFlashSaleInput, validateProductBundleInput } from "@/utils/marketingValidation.util";

function readFlashSaleInput(request: MockRequest): FlashSaleInput {
  const body = readJsonObjectBody(request);
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    startsAt: typeof body.startsAt === "string" ? body.startsAt : "",
    endsAt: typeof body.endsAt === "string" ? body.endsAt : "",
    items: items.map((item) => ({ productId: String(item.productId ?? ""), salePriceMinor: Number(item.salePriceMinor), stockCap: item.stockCap === null || item.stockCap === undefined ? null : Number(item.stockCap) })),
  };
}

function readBundleInput(request: MockRequest): ProductBundleInput {
  const body = readJsonObjectBody(request);
  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    bundlePriceMinor: Number(body.bundlePriceMinor),
    status: body.status === "paused" || body.status === "draft" ? body.status : "active",
    items: items.map((item) => ({ productId: String(item.productId ?? ""), quantity: Number(item.quantity) })),
  };
}

function refreshFlashSaleStatuses(): FlashSale[] {
  const state = readMarketingState();
  state.flashSales = state.flashSales.map((sale) => ({ ...sale, status: deriveTimeBoxedCampaignStatus(sale.startsAt, sale.endsAt, sale.status) }));
  return state.flashSales;
}

function buildFlashSaleFromInput(input: FlashSaleInput, existing: FlashSale | null): FlashSale {
  const currency = readMockDatabase().settings.currency;
  const items = input.items.map((item, index) => {
    const option = findMarketingProductOptionOrThrow(item.productId, `items.${index}.productId`);
    if (item.salePriceMinor >= option.price.amountMinor) throw new MockHttpError(400, "VALIDATION_FAILED", `${option.name}: the flash price must be lower than the regular price.`);
    const soldCount = existing?.items.find((existingItem) => existingItem.productId === item.productId)?.soldCount ?? 0;
    return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, originalPrice: option.price, salePrice: { amountMinor: item.salePriceMinor, currency }, stockCap: item.stockCap, soldCount };
  });
  const startsAt = new Date(input.startsAt).toISOString();
  const endsAt = new Date(input.endsAt).toISOString();
  return {
    id: existing?.id ?? createMockIdentifier("flash"),
    name: input.name,
    items,
    startsAt,
    endsAt,
    status: deriveTimeBoxedCampaignStatus(startsAt, endsAt, existing?.status === "paused" ? "paused" : "scheduled"),
    reach: existing?.reach ?? 0,
    revenue: { amountMinor: items.reduce((sum, item) => sum + item.salePrice.amountMinor * item.soldCount, 0), currency },
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

function buildBundleFromInput(input: ProductBundleInput, existing: ProductBundle | null): ProductBundle {
  const currency = readMockDatabase().settings.currency;
  const items = input.items.map((item, index) => {
    const option = findMarketingProductOptionOrThrow(item.productId, `items.${index}.productId`);
    return { productId: option.productId, productName: option.name, imageUrl: option.imageUrl, quantity: item.quantity, unitPrice: option.price };
  });
  const regularMinor = items.reduce((sum, item) => sum + item.unitPrice.amountMinor * item.quantity, 0);
  if (input.bundlePriceMinor >= regularMinor) throw new MockHttpError(400, "VALIDATION_FAILED", "The bundle price must be lower than buying the items separately.");
  return {
    id: existing?.id ?? createMockIdentifier("bundle"),
    name: input.name,
    description: input.description,
    items,
    regularPrice: { amountMinor: regularMinor, currency },
    bundlePrice: { amountMinor: input.bundlePriceMinor, currency },
    status: input.status,
    soldCount: existing?.soldCount ?? 0,
    revenue: { amountMinor: input.bundlePriceMinor * (existing?.soldCount ?? 0), currency },
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

function findIndexOrThrow<Item extends { readonly id: string }>(items: readonly Item[], id: string, label: string): number {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new MockHttpError(404, "NOT_FOUND", `That ${label} no longer exists.`);
  return index;
}

function registerFlashSaleMockRoutes(): void {
  registerMockRoute("GET", "/seller/marketing/flash-sales", (request) => {
    requireMarketingPlanFeature(request);
    const status = request.query.get("status");
    const sales = refreshFlashSaleStatuses().filter((sale) => !status || status === "all" || sale.status === status);
    return respondWithJson(200, paginateMockList([...sales].sort((first, second) => second.startsAt.localeCompare(first.startsAt)), request.query, 50));
  });

  registerMockRoute("POST", "/seller/marketing/flash-sales", (request) => {
    requireMarketingPlanFeature(request);
    const input = readFlashSaleInput(request);
    const issues = validateFlashSaleInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const sale = buildFlashSaleFromInput(input, null);
    readMarketingState().flashSales.unshift(sale);
    return respondWithJson(201, sale);
  });

  registerMockRoute("PATCH", "/seller/marketing/flash-sales/:flashSaleId", (request) => {
    requireMarketingPlanFeature(request);
    const state = readMarketingState();
    const index = findIndexOrThrow(state.flashSales, request.params.flashSaleId ?? "", "flash sale");
    const current = state.flashSales[index] as FlashSale;
    const body = readJsonObjectBody(request);
    if (body.action === "pause" || body.action === "resume" || body.action === "end") {
      const updated: FlashSale = body.action === "end" ? { ...current, endsAt: new Date().toISOString(), status: "ended" } : { ...current, status: body.action === "pause" ? "paused" : deriveTimeBoxedCampaignStatus(current.startsAt, current.endsAt, "scheduled") };
      state.flashSales[index] = updated;
      return respondWithJson(200, updated);
    }
    if (current.status === "ended") throw new MockHttpError(409, "FLASH_SALE_ENDED", "This flash sale has ended. Duplicate it to run it again.");
    const input = readFlashSaleInput(request);
    const issues = validateFlashSaleInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updated = buildFlashSaleFromInput(input, current);
    state.flashSales[index] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/marketing/flash-sales/:flashSaleId", (request) => {
    requireMarketingPlanFeature(request);
    const state = readMarketingState();
    const index = findIndexOrThrow(state.flashSales, request.params.flashSaleId ?? "", "flash sale");
    if (state.flashSales[index]?.status === "active") throw new MockHttpError(409, "FLASH_SALE_ACTIVE", "End the flash sale before deleting it.");
    state.flashSales.splice(index, 1);
    return respondWithNoContent();
  });
}

export function registerFlashSaleAndBundleMockRoutes(): void {
  registerFlashSaleMockRoutes();

  registerMockRoute("GET", "/seller/marketing/bundles", (request) => {
    requireMarketingPlanFeature(request);
    return respondWithJson(200, paginateMockList(readMarketingState().bundles, request.query, 50));
  });

  registerMockRoute("POST", "/seller/marketing/bundles", (request) => {
    requireMarketingPlanFeature(request);
    const input = readBundleInput(request);
    const issues = validateProductBundleInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const bundle = buildBundleFromInput(input, null);
    readMarketingState().bundles.unshift(bundle);
    return respondWithJson(201, bundle);
  });

  registerMockRoute("PATCH", "/seller/marketing/bundles/:bundleId", (request) => {
    requireMarketingPlanFeature(request);
    const state = readMarketingState();
    const index = findIndexOrThrow(state.bundles, request.params.bundleId ?? "", "bundle");
    const input = readBundleInput(request);
    const issues = validateProductBundleInput(input);
    if (issues.length > 0) return respondWithValidationFailure(issues);
    const updated = buildBundleFromInput(input, state.bundles[index] as ProductBundle);
    state.bundles[index] = updated;
    return respondWithJson(200, updated);
  });

  registerMockRoute("DELETE", "/seller/marketing/bundles/:bundleId", (request) => {
    requireMarketingPlanFeature(request);
    const state = readMarketingState();
    state.bundles.splice(findIndexOrThrow(state.bundles, request.params.bundleId ?? "", "bundle"), 1);
    return respondWithNoContent();
  });
}
