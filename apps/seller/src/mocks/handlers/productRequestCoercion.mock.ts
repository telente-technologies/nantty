import type { ProductStatus, ProductVisibility } from "@/types/catalog.type";
import type { CurrencyCode } from "@/types/money.type";
import type { ProductUpsertRequest } from "@/types/productRequests.type";

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNullableInteger(value: unknown): number | null {
  return value === null || value === undefined || value === "" ? null : (value as number);
}

export function coerceProductUpsertRequest(body: Record<string, unknown>): ProductUpsertRequest {
  const options = Array.isArray(body.options) ? body.options : [];
  const variants = Array.isArray(body.variants) ? body.variants : [];
  return {
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : "",
    categoryId: typeof body.categoryId === "string" ? body.categoryId : null,
    status: body.status as ProductStatus,
    taxable: body.taxable as boolean,
    trackInventory: body.trackInventory as boolean,
    publishedOnline: body.publishedOnline as boolean,
    tags: readStringArray(body.tags),
    imageMediaIds: readStringArray(body.imageMediaIds),
    options: options.map((option) => {
      const record = (typeof option === "object" && option !== null ? option : {}) as Record<string, unknown>;
      return { name: typeof record.name === "string" ? record.name : "", values: readStringArray(record.values) };
    }),
    variants: variants.map((variant) => {
      const record = (typeof variant === "object" && variant !== null ? variant : {}) as Record<string, unknown>;
      const optionValues = typeof record.optionValues === "object" && record.optionValues !== null ? (record.optionValues as Record<string, unknown>) : {};
      return {
        id: typeof record.id === "string" ? record.id : null,
        optionValues: Object.fromEntries(Object.entries(optionValues).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
        sku: typeof record.sku === "string" ? record.sku : "",
        barcode: typeof record.barcode === "string" && record.barcode !== "" ? record.barcode : null,
        priceMinor: record.priceMinor as number,
        compareAtPriceMinor: readNullableInteger(record.compareAtPriceMinor),
        costPriceMinor: readNullableInteger(record.costPriceMinor),
        regionalPrices: (Array.isArray(record.regionalPrices) ? record.regionalPrices : []).map((entry) => {
          const priceRecord = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
          return { currency: priceRecord.currency as CurrencyCode, priceMinor: priceRecord.priceMinor as number };
        }),
        lowStockThreshold: record.lowStockThreshold as number,
        reorderPoint: typeof record.reorderPoint === "number" ? record.reorderPoint : undefined,
        reorderQuantity: typeof record.reorderQuantity === "number" ? record.reorderQuantity : undefined,
        openingStock: (Array.isArray(record.openingStock) ? record.openingStock : []).map((entry) => {
          const stockRecord = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
          return { locationId: String(stockRecord.locationId ?? ""), quantity: stockRecord.quantity as number };
        }),
      };
    }),
    visibility: typeof body.visibility === "string" ? (body.visibility as ProductVisibility) : undefined,
    publishAt: typeof body.publishAt === "string" && body.publishAt !== "" ? body.publishAt : null,
    attributes: Array.isArray(body.attributes) ? body.attributes.map((attribute) => {
      const record = (typeof attribute === "object" && attribute !== null ? attribute : {}) as Record<string, unknown>;
      return { name: typeof record.name === "string" ? record.name : "", value: typeof record.value === "string" ? record.value : "" };
    }) : undefined,
    videos: Array.isArray(body.videos) ? body.videos.map((video) => {
      const record = (typeof video === "object" && video !== null ? video : {}) as Record<string, unknown>;
      return { url: typeof record.url === "string" ? record.url : "", title: typeof record.title === "string" ? record.title : "" };
    }) : undefined,
    supplierId: body.supplierId === undefined ? undefined : typeof body.supplierId === "string" && body.supplierId !== "" ? body.supplierId : null,
  };
}

