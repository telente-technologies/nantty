import { ApiError } from "@/errors/api.error";
import type { SellerApplication, SellerApplicationInput, SellerDashboardPeriod, StoreProduct } from "@/types/account.type";
import type { SellerDashboard } from "@/types";

import { bankNameForCode } from "./banks.mock";
import { buildOrderFromRecord } from "./escrowBuilders.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { buildShipment, mockOrderRecords, usdCentsForOrderRecord, type MockOrderRecord } from "./orderFixtures.mock";
import { catalogProductSeeds, buildCatalogProductSummary } from "./productCatalog.mock";
import { productImageUrlsForProduct } from "./mockImages.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { productCategories } from "./storeDirectory.mock";

const HOUR = 3_600_000;
const PERIOD_WINDOW_HOURS: Record<SellerDashboardPeriod, number> = { live: 1, today: 24, yesterday: 48, week: 168, month: 720, all: 24 * 3650 };
const CHART_BUCKET_COUNT = 12;

const signedInStoreId = () => getSignedInMockUser().storeId ?? null;
const listSignedInStoreOrderRecords = () =>
  mockOrderRecords.filter((record) => record.storeId === signedInStoreId()).sort((a, b) => b.placedAt.localeCompare(a.placedAt));

const findStoreOrderRecordOrThrow = (orderId: string): MockOrderRecord => {
  const record = listSignedInStoreOrderRecords().find((candidate) => candidate.id === orderId);
  if (!record) throw new ApiError(404, "Order not found");
  return record;
};

const catalogStoreProducts = (): StoreProduct[] =>
  catalogProductSeeds
    .filter((seed) => seed.storeId === signedInStoreId())
    .map((seed) => ({
      ...buildCatalogProductSummary(seed),
      stock: buildCatalogProductSummary(seed).stock ?? seed.stock,
      description: seed.description,
      sizes: seed.sizes,
      colors: seed.colors,
      imageUrls: productImageUrlsForProduct(seed.key),
      published: true,
    }));

const listStoreProducts = (): StoreProduct[] => catalogStoreProducts();

const isCountedAsSale = (record: MockOrderRecord) => record.status !== "pending" && record.status !== "cancelled";

function buildSellerDashboard(period: SellerDashboardPeriod): SellerDashboard {
  const windowStart = Date.now() - PERIOD_WINDOW_HOURS[period] * HOUR;
  const windowEnd = period === "yesterday" ? Date.now() - 24 * HOUR : Date.now();
  const sales = listSignedInStoreOrderRecords().filter((record) => {
    const placed = new Date(record.placedAt).getTime();
    return isCountedAsSale(record) && placed >= windowStart && placed <= windowEnd;
  });
  const bucketSpan = (windowEnd - windowStart) / CHART_BUCKET_COUNT;
  const bucketCounts = Array.from({ length: CHART_BUCKET_COUNT }, () => 0);
  sales.forEach((record) => {
    const bucket = Math.min(CHART_BUCKET_COUNT - 1, Math.floor((new Date(record.placedAt).getTime() - windowStart) / bucketSpan));
    bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
  });
  return {
    totalSales: convertUsdCentsToViewerCurrency(sales.reduce((sum, record) => sum + usdCentsForOrderRecord(record), 0)),
    orders: sales.length,
    series: bucketCounts.map((value, index) => ({ label: String(index), value })),
    recentOrders: listSignedInStoreOrderRecords().slice(0, 4).map(buildOrderFromRecord),
    inventory: listStoreProducts().slice(0, 6),
  };
}

const applicationsByUserId = new Map<string, SellerApplication>();

const maskAllButLastFour = (value: string) => `•••• ${value.replace(/\s/g, "").slice(-4)}`;

function validateSellerApplication(input: SellerApplicationInput) {
  const requiredText = [input.storeName, input.categoryId, input.description, input.phone, input.addressLine, input.city, input.state];
  if (requiredText.some((value) => !value?.trim())) throw new ApiError(422, "Please complete every step before submitting");
  if (!input.identityDocument?.documentPhotoUrl) throw new ApiError(422, "Add a photo of your ID document");
  if ((input.identityDocument.documentNumber ?? "").replace(/\s/g, "").length < 6) throw new ApiError(422, "Check your ID number");
  if (!/^\d{10}$/.test(input.payoutAccount?.accountNumber ?? "")) throw new ApiError(422, "Enter a valid 10-digit account number");
}

export const sellerMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/seller/dashboard", ({ query }) => buildSellerDashboard((query.get("period") as SellerDashboardPeriod) ?? "today")),
  createMockRoute("GET", "/api/v1/seller/applications/me", () => applicationsByUserId.get(getSignedInMockUser().id) ?? null),
  createMockRoute("POST", "/api/v1/seller/applications", ({ body }) => {
    const existing = applicationsByUserId.get(getSignedInMockUser().id);
    if (existing?.status === "pending") return existing;
    const input = body as SellerApplicationInput;
    validateSellerApplication(input);
    const application: SellerApplication = {
      id: `sa_${Date.now()}`,
      status: "pending",
      storeName: input.storeName.trim(),
      categoryName: productCategories.find((category) => category.id === input.categoryId)?.name ?? input.categoryId,
      city: input.city.trim(),
      state: input.state.trim(),
      identityDocumentType: input.identityDocument.documentType,
      identityDocumentNumberMasked: maskAllButLastFour(input.identityDocument.documentNumber),
      payoutBankName: bankNameForCode(input.payoutAccount.bankCode),
      payoutAccountNumberMasked: maskAllButLastFour(input.payoutAccount.accountNumber),
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      rejectionReason: null,
    };
    applicationsByUserId.set(getSignedInMockUser().id, application);
    return application;
  }),
  createMockRoute("GET", "/api/v1/seller/orders", () => listSignedInStoreOrderRecords().map(buildOrderFromRecord)),
  createMockRoute("GET", "/api/v1/seller/orders/:orderId", ({ params }) => buildOrderFromRecord(findStoreOrderRecordOrThrow(params.orderId!))),
  createMockRoute("POST", "/api/v1/seller/orders/:orderId/fulfilment", ({ params, body }) => {
    const record = findStoreOrderRecordOrThrow(params.orderId!);
    if (record.status === "shipped") return buildOrderFromRecord(record);
    if (record.status !== "paid") throw new ApiError(409, "Only paid orders can be marked as shipped");
    const { courier, trackingNumber, fromLocationId } = body as { courier?: string; trackingNumber?: string; fromLocationId?: string };
    if (!courier?.trim() || !trackingNumber?.trim() || !fromLocationId) throw new ApiError(422, "Add the courier and tracking number", "VALIDATION_FAILED");
    record.shipment = buildShipment(courier.trim(), trackingNumber.trim().toUpperCase(), new Date().toISOString());
    record.status = "shipped";
    return buildOrderFromRecord(record);
  }),
];
