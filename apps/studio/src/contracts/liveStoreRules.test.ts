import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/errors/api.error";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { StudioRequestError } from "@/services/clientApi.service";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";

const send = (method: string, path: string, body: unknown) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(), new TextEncoder().encode(JSON.stringify(body)));

const rejectsWith = async (request: Promise<unknown>, status: number, code: string) => {
  await assert.rejects(request, (error: unknown) => error instanceof ApiError && error.status === status && error.code === code);
};

describe("live store ownership rules in the studio mocks", () => {
  it("refuses products without a store and foreign stores", async () => {
    await rejectsWith(send("POST", "/api/v1/lives", { title: "No store", category: "music", productIds: ["prod_1"] }), 422, "PRODUCTS_REQUIRE_STORE");
    await rejectsWith(send("POST", "/api/v1/lives", { title: "Theirs", category: "shopping", storeId: "store_other" }), 403, "NOT_STORE_MEMBER");
    await rejectsWith(send("POST", "/api/v1/lives", { title: "Foreign", category: "shopping", storeId: "store_1", productIds: ["prod_x"] }), 403, "PRODUCT_NOT_IN_STORE");
  });

  it("keeps the store on the live and refuses pins on a store-less live", async () => {
    const live = (await send("POST", "/api/v1/lives", { title: "Mine", category: "shopping", storeId: "store_1", startNow: false })) as { id: string; storeId: string | null };
    assert.equal(live.storeId, "store_1");
    const personal = (await send("POST", "/api/v1/lives", { title: "Chat", category: "music", startNow: false })) as { id: string; storeId: string | null };
    assert.equal(personal.storeId, null);
    await rejectsWith(send("POST", `/api/v1/lives/${personal.id}/pins`, { productId: "prod_1" }), 422, "PRODUCTS_REQUIRE_STORE");
    await rejectsWith(send("POST", `/api/v1/lives/${live.id}/pins`, { productId: "prod_x" }), 403, "PRODUCT_NOT_IN_STORE");
  });

  it("shows readable messages for every store error code", () => {
    for (const code of ["PRODUCTS_REQUIRE_STORE", "NOT_STORE_MEMBER", "PRODUCT_NOT_IN_STORE", "PRODUCT_NOT_PUBLISHED", "CATALOG_UNAVAILABLE"]) {
      const message = readLiveErrorMessage(new StudioRequestError(422, code, "raw backend text"));
      assert.notEqual(message, "raw backend text", code);
      assert.ok(message.length > 10, code);
    }
  });
});
