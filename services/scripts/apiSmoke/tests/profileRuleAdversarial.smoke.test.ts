import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, stepUpUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor, type ApiResponse } from "../src/apiClient.util.js";
import { addToCart, checkout, createBuyerWithAddress, createStoreWithProduct, psql, shipAndDeliver, stockStoreWithProduct, type SmokeStore } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider } from "../src/fakeFlutterwave.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";

const limitCode = "PROFILE_LIMIT_STORE_OR_BUSINESS";
let marketplaceCategoryId = "";

function pageBody(purpose: "store" | "business"): Record<string, unknown> {
  const handle = `pr${purpose[0]}${uniqueSuffix()}`.slice(0, 28);
  return { displayName: `Rule ${handle}`, handle, description: "Profile rule smoke", purpose, categories: [{ customName: "Community work" }] };
}

function applicationBody(): Record<string, unknown> {
  return {
    storeName: `Rule shop ${uniqueSuffix()}`, categoryId: marketplaceCategoryId, description: "Profile rule smoke", phone: "+234 801 234 5678", addressLine: "12 Allen Avenue", city: "Ikeja", state: "Lagos",
    identityDocument: { documentType: "nin_slip", documentNumber: "12345678901", documentPhotoUrl: "https://media.nantty.com/kyc/nin.jpg" },
    payoutAccount: { bankCode: "058", accountNumber: "0123456789" },
  };
}

function brandBody(): Record<string, unknown> {
  const handle = `prb${uniqueSuffix()}`.slice(0, 28);
  return { name: `Brand ${handle}`, handle, logoUrl: null, coverUrl: null, categoryId: marketplaceCategoryId, description: "Made in Lagos", website: null };
}

async function linked(user: UserActor): Promise<any> {
  const response = await callApi("GET", "/api/v1/users/me/linked-profiles", { token: user.accessToken });
  expect(response.status, describeResponse(response)).toBe(200);
  return response.body;
}

function activeSlots(summary: any): any[] {
  return (summary.items as any[]).filter((item) => item.status === "active" && (item.kind === "store" || item.kind === "business"));
}

async function upgradeToBusinessPlan(store: SmokeStore): Promise<void> {
  const started = await callApi("POST", "/api/v1/seller/subscription/checkout", { token: store.seller.accessToken, headers: { "x-client-platform": "web", "x-client-region": "NG" }, body: { profileId: store.businessProfileId, planId: "seller_business_monthly" } });
  expect(started.status, describeResponse(started)).toBe(201);
  await payCheckoutThroughProvider(started.body.reference);
  const active = await waitFor(async () => {
    const current = await callApi("GET", "/api/v1/seller/subscription", { token: store.seller.accessToken, headers: { "x-store-id": store.storeId, "x-seller-store": store.storeId } });
    return /business/.test(JSON.stringify(current.body ?? {})) ? true : undefined;
  }, 30_000, 1000);
  expect(active, "business plan never became active").toBe(true);
}

function createdOnce(responses: readonly ApiResponse[]): ApiResponse[] {
  return responses.filter((response) => response.status === 201);
}

describe("profile rule against the live stack", () => {
  let storeOwner: SmokeStore;

  beforeAll(async () => {
    const categories = await callApi("GET", "/api/v1/categories");
    marketplaceCategoryId = (categories.body.data ?? categories.body)[0].id;
    storeOwner = await createStoreWithProduct("prowner", 300_000);
  }, 300_000);

  it("parallel business-page and seller-application creates let exactly one win", async () => {
    for (let round = 0; round < 3; round += 1) {
      const user = await registerUser("prrace");
      const [page, application] = await Promise.all([
        callApi("POST", "/api/v1/users/me/business-profiles", { token: user.accessToken, body: pageBody("business") }),
        callApi("POST", "/api/v1/seller/applications", { token: user.accessToken, body: applicationBody() }),
      ]);
      expect(createdOnce([page, application]).length, `${describeResponse(page)} | ${describeResponse(application)}`).toBe(1);
      expectClearError(page.status === 201 ? application : page, 409, limitCode);
      expect(activeSlots(await linked(user)).length).toBe(1);
    }
  });

  it("a deep link to create a business page is refused when a store exists, in the summary and at the API", async () => {
    const summary = await linked(storeOwner.seller);
    expect(summary.canCreate).toMatchObject({ store: false, business: false });
    for (const purpose of ["business", "store"] as const) {
      expectClearError(await callApi("POST", "/api/v1/users/me/business-profiles", { token: storeOwner.seller.accessToken, body: pageBody(purpose) }), 409, limitCode);
    }
    expectClearError(await callApi("POST", "/api/v1/seller/applications", { token: storeOwner.seller.accessToken, body: applicationBody() }), 409);
    const viewer = await registerUser("prviewer");
    const seen = await callApi("GET", `/api/v1/users/${storeOwner.seller.accountId}`, { token: viewer.accessToken });
    expect(seen.body, describeResponse(seen)).toMatchObject({ profileKind: "store", showsMart: true });
    const business = await registerUser("prbiz");
    expect((await callApi("POST", "/api/v1/users/me/business-profiles", { token: business.accessToken, body: pageBody("business") })).status).toBe(201);
    const businessSeen = await callApi("GET", `/api/v1/users/${business.accountId}`, { token: viewer.accessToken });
    expect(businessSeen.body, describeResponse(businessSeen)).toMatchObject({ profileKind: "business", showsMart: false });
  });

  it("a double tap creates one page and one brand", async () => {
    const user = await registerUser("prtap");
    const body = pageBody("business");
    const key = { "idempotency-key": `pr-tap-${uniqueSuffix()}` };
    const taps = await Promise.all([0, 1].map(() => callApi("POST", "/api/v1/users/me/business-profiles", { token: user.accessToken, headers: key, body })));
    const ids = new Set(taps.filter((tap) => tap.status === 201).map((tap) => tap.body.id));
    expect(ids.size, taps.map(describeResponse).join(" | ")).toBe(1);
    expectClearError(await callApi("POST", "/api/v1/users/me/business-profiles", { token: user.accessToken, body: pageBody("business") }), 409, limitCode);
    const brand = brandBody();
    const brandKey = { "idempotency-key": `pr-brand-${uniqueSuffix()}` };
    const brandTaps = await Promise.all([0, 1].map(() => callApi("POST", "/api/v1/brands", { token: user.accessToken, headers: brandKey, body: brand })));
    expect(new Set(brandTaps.filter((tap) => tap.status === 201).map((tap) => tap.body.id)).size, brandTaps.map(describeResponse).join(" | ")).toBe(1);
    expectClearError(await callApi("POST", "/api/v1/brands", { token: user.accessToken, body: brandBody() }), 409, "PROFILE_LIMIT_ONE_BRAND");
    const summary = await linked(user);
    expect(summary.items.filter((item: any) => item.status === "active").length).toBe(2);
  });

  it("PATCH brand needs the owner's own step-up", async () => {
    const owner = await registerUser("prbrand");
    const brand = await callApi("POST", "/api/v1/brands", { token: owner.accessToken, body: brandBody() });
    expect(brand.status, describeResponse(brand)).toBe(201);
    const path = `/api/v1/brands/${brand.body.id}`;
    expectClearError(await callApi("PATCH", path, { token: owner.accessToken, body: { sellingEnabled: true } }), [401, 403]);
    const intruder = await registerUser("printruder");
    expectClearError(await callApi("PATCH", path, { token: intruder.accessToken, headers: { "x-step-up-token": await stepUpUser(intruder) }, body: { sellingEnabled: true } }), [403, 404]);
    expectClearError(await callApi("PATCH", path, { token: owner.accessToken, headers: { "x-step-up-token": await stepUpUser(intruder) }, body: { sellingEnabled: true } }), [401, 403]);
    const on = await callApi("PATCH", path, { token: owner.accessToken, headers: { "x-step-up-token": await stepUpUser(owner) }, body: { sellingEnabled: true } });
    expect(on.status, describeResponse(on)).toBe(200);
    expect(on.body.sellingEnabled).toBe(true);
  });

  it("a grandfathered held page cannot post until the owner chooses to keep it", async () => {
    const owner = await registerUser("prheld");
    const page = await callApi("POST", "/api/v1/users/me/business-profiles", { token: owner.accessToken, body: pageBody("business") });
    expect(page.status, describeResponse(page)).toBe(201);
    psql(`update users.linked_profiles set status = 'held', hold_reason = 'smoke grandfathering' where profile_id = '${page.body.id}'`);
    psql(`update users.profiles set publishing_held = true where id = '${page.body.id}'`);
    expectClearError(await callApi("POST", "/api/v1/posts", { token: owner.accessToken, body: { text: "Posting as a held page", audience: "everyone", asProfileId: page.body.id } }), 409, "PROFILE_ON_HOLD");
    expect((await callApi("POST", "/api/v1/posts", { token: owner.accessToken, body: { text: "Personal posts still work", audience: "everyone" } })).status).toBe(201);
    expect((await linked(owner)).choiceRequired).toBe(true);
    expectClearError(await callApi("POST", "/api/v1/users/me/linked-profiles/choose", { token: owner.accessToken, body: { keep: [page.body.id] } }), [401, 403]);
    const chosen = await callApi("POST", "/api/v1/users/me/linked-profiles/choose", { token: owner.accessToken, headers: { "x-step-up-token": await stepUpUser(owner) }, body: { keep: [page.body.id] } });
    expect(chosen.status, describeResponse(chosen)).toBe(200);
    const posted = await callApi("POST", "/api/v1/posts", { token: owner.accessToken, body: { text: "Back after choosing", audience: "everyone", asProfileId: page.body.id } });
    expect(posted.status, describeResponse(posted)).toBe(201);
  });

  it("a team member cannot spend the owner's slot or open a store on the owner's page", async () => {
    const member = await registerUser("prmember");
    const headers = { "x-store-id": storeOwner.storeId, "x-seller-store": storeOwner.storeId };
    await upgradeToBusinessPlan(storeOwner);
    const locations = await callApi("GET", "/api/v1/seller/locations", { token: storeOwner.seller.accessToken, headers });
    const added = (await waitFor(async () => {
      const response = await callApi("POST", "/api/v1/seller/staff", { token: storeOwner.seller.accessToken, headers, body: { userId: member.accountId, role: "manager", locationIds: [locations.body.data?.[0]?.id].filter(Boolean) } });
      return response.status === 402 ? undefined : response;
    }, 20_000, 2000))!;
    expect(added, "the business plan never unlocked the team feature").toBeDefined();
    expect([200, 201], describeResponse(added)).toContain(added.status);
    {
      const requests = await callApi("GET", "/api/v1/stores/team-requests", { token: member.accessToken });
      const request = (requests.body.data ?? []).find((item: any) => item.storeId === storeOwner.storeId);
      expect(request, describeResponse(requests)).toBeDefined();
      expect((await callApi("POST", `/api/v1/stores/team-requests/${request.id}/accept`, { token: member.accessToken, body: {} })).status).toBeLessThan(300);
    }
    const onBehalf = await callApi("POST", "/api/v1/stores", { token: member.accessToken, headers, body: { businessProfileId: storeOwner.businessProfileId, name: "On behalf", countryCode: "NG" } });
    expectClearError(onBehalf, [403, 404, 409, 422]);
    const ownerBefore = await linked(storeOwner.seller);
    const memberPage = await callApi("POST", "/api/v1/users/me/business-profiles", { token: member.accessToken, headers, body: pageBody("business") });
    expect(memberPage.status, describeResponse(memberPage)).toBe(201);
    const ownerAfter = await linked(storeOwner.seller);
    expect(ownerAfter.items.length).toBe(ownerBefore.items.length);
    expect(activeSlots(await linked(member))[0]?.profileId).toBe(memberPage.body.id);
    const memberBrand = await callApi("POST", "/api/v1/brands", { token: member.accessToken, headers, body: brandBody() });
    expect(memberBrand.status, describeResponse(memberBrand)).toBe(201);
    expect(psql(`select owner_account_id from catalog.brands where id = '${memberBrand.body.id}'`)[0]?.[0], "a brand made by a team member belongs to the member").toBe(member.accountId);
    expect((await linked(storeOwner.seller)).canCreate.brand, "the owner's brand slot is untouched").toBe(true);
  });

  it("turning brand selling off with an open order pauses the storefront but the order still completes", { timeout: 240_000 }, async () => {
    const owner = storeOwner.seller;
    const brand = await callApi("POST", "/api/v1/brands", { token: owner.accessToken, body: brandBody() });
    expect(brand.status, describeResponse(brand)).toBe(201);
    const path = `/api/v1/brands/${brand.body.id}`;
    expect((await callApi("PATCH", path, { token: owner.accessToken, headers: { "x-step-up-token": await stepUpUser(owner) }, body: { sellingEnabled: true } })).status).toBe(200);
    const storefront = await callApi("POST", `${path}/storefront`, { token: owner.accessToken, body: {} });
    expect(storefront.status, describeResponse(storefront)).toBe(201);
    const storefrontId: string = storefront.body.storefront?.id ?? storefront.body.id;
    const shelf = await stockStoreWithProduct(owner, storefrontId, storeOwner.businessProfileId, "prbrandshelf", 200_000);
    const { buyer, addressId } = await createBuyerWithAddress();
    await addToCart(buyer, shelf, 1);
    const placed = await checkout(buyer, addressId);
    const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId: placed.checkoutId } });
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    await payCheckoutThroughProvider(initialized.body.reference, 0);
    const orderId = placed.orderIds[0]!;
    expect(await waitFor(async () => psql(`select status from escrow.escrows where order_id = '${orderId}'`)[0]?.[0] === "held" || undefined, 30_000, 500), "order never paid").toBe(true);

    const off = await callApi("PATCH", path, { token: owner.accessToken, headers: { "x-step-up-token": await stepUpUser(owner) }, body: { sellingEnabled: false } });
    expect(off.status, describeResponse(off)).toBe(200);
    expect(psql(`select status from catalog.stores where id = '${storefrontId}'`)[0]?.[0]).toBe("paused");
    const brandProducts = await callApi("GET", `${path}/products`);
    expect(JSON.stringify(brandProducts.body)).not.toContain(shelf.productId);
    const newListing = await callApi("POST", "/api/v1/seller/products", { token: owner.accessToken, headers: { "x-store-id": storefrontId, "x-seller-store": storefrontId }, body: { ...shelf.productBody, name: "After pause" } });
    expectClearError(newListing, [403, 409, 422]);
    const lateBuyer = await createBuyerWithAddress();
    const lateAdd = await callApi("POST", "/api/v1/cart/items", { token: lateBuyer.buyer.accessToken, body: { productId: shelf.productId, variantId: shelf.variantId, quantity: 1 } });
    expect(lateAdd.status, describeResponse(lateAdd)).toBeGreaterThanOrEqual(400);

    await shipAndDeliver(shelf, orderId);
    const order = await callApi("GET", `/api/v1/orders/${orderId}`, { token: buyer.accessToken });
    expect(order.status, describeResponse(order)).toBe(200);
    expect(JSON.stringify(order.body)).toMatch(/delivered/i);
  });
});
