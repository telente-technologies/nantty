import { pickLiveHostStore } from "@/components/live/liveHostStore.hook";
import { ApiError } from "@/errors/api.error";
import { resolveMockApiRequest } from "@/mocks";
import { listProductSummariesInStore } from "@/mocks/productCatalog.mock";
import type { LiveSessionDetails } from "@/types";
import type { MyStoreSummary } from "@/types/commerce.type";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

jest.setTimeout(15000);

const startLive = (body: Record<string, unknown>) => resolveMockApiRequest<LiveSessionDetails>("POST", "/api/v1/lives", { title: "Test live", category: "shopping", ...body });
const failureOf = (request: Promise<unknown>) => request.catch((error: unknown) => error);

describe("live store ownership in the mobile mocks", () => {
  it("lists the seller's own store", async () => {
    const stores = await resolveMockApiRequest<MyStoreSummary[]>("GET", "/api/v1/seller/stores/mine", undefined);
    expect(stores).toEqual([expect.objectContaining({ storeId: "s_home", isCurrent: true })]);
  });

  it("refuses products without a store, foreign stores and foreign products", async () => {
    expect(await failureOf(startLive({ productIds: ["p_any"] }))).toMatchObject({ status: 422, code: "PRODUCTS_REQUIRE_STORE" });
    expect(await failureOf(startLive({ storeId: "s_glow" }))).toMatchObject({ status: 403, code: "NOT_STORE_MEMBER" });
    const foreign = listProductSummariesInStore("s_glow")[0]!.id;
    expect(await failureOf(startLive({ storeId: "s_home", productIds: [foreign] }))).toMatchObject({ status: 403, code: "PRODUCT_NOT_IN_STORE" });
  });

  it("keeps the store on the live and only pins that store's products", async () => {
    const own = listProductSummariesInStore("s_home")[0]!.id;
    const live = await startLive({ storeId: "s_home", productIds: [own] });
    expect(live.storeId).toBe("s_home");
    const foreign = listProductSummariesInStore("s_glow")[0]!.id;
    expect(await failureOf(resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/pins`, { productId: foreign }))).toMatchObject({ status: 403, code: "PRODUCT_NOT_IN_STORE" });
    await resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/pins`, { productId: own });
    await resolveMockApiRequest("POST", `/api/v1/lives/${live.id}/end`, undefined);
    const personal = await resolveMockApiRequest<LiveSessionDetails>("POST", "/api/v1/lives", { title: "Chat", category: "justChatting" });
    expect(personal.storeId ?? null).toBeNull();
    expect(await failureOf(resolveMockApiRequest("POST", `/api/v1/lives/${personal.id}/pins`, { productId: own }))).toMatchObject({ status: 422, code: "PRODUCTS_REQUIRE_STORE" });
  });
});

describe("live host store helpers", () => {
  const stores: MyStoreSummary[] = [
    { storeId: "a", storeName: "A", role: "owner", isCurrent: false },
    { storeId: "b", storeName: "B", role: "sales", isCurrent: true },
  ];

  it("prefers the switched-to store, then the current one, then the first", () => {
    expect(pickLiveHostStore(stores, "a")?.storeId).toBe("a");
    expect(pickLiveHostStore(stores, null)?.storeId).toBe("b");
    expect(pickLiveHostStore([stores[0]!], "missing")?.storeId).toBe("a");
    expect(pickLiveHostStore([], "a")).toBeNull();
  });

  it("turns every store error code into a readable message", () => {
    for (const code of ["PRODUCTS_REQUIRE_STORE", "NOT_STORE_MEMBER", "PRODUCT_NOT_IN_STORE", "PRODUCT_NOT_PUBLISHED", "CATALOG_UNAVAILABLE"]) {
      expect(readLiveErrorMessage(new ApiError(422, "raw", code), "fallback")).not.toMatch(/^(raw|fallback)$/);
    }
    expect(readLiveErrorMessage(new ApiError(500, "raw", "OTHER"), "fallback")).toBe("fallback");
  });
});
