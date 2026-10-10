import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSuperadmin, registerUser, stepUpStaff, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix } from "../src/apiClient.util.js";
import { verifySellerBusiness } from "../src/sellerVerification.util.js";

const outputPath = process.env["LOAD_FIXTURES_PATH"] ?? resolve(import.meta.dirname, "../reports/loadFixtures.json");
const userCount = Number(process.env["LOAD_USER_COUNT"] ?? "10");

async function expectOk(label: string, response: Awaited<ReturnType<typeof callApi>>): Promise<any> {
  if (response.status >= 300) throw new Error(`${label}: ${describeResponse(response)}`);
  return response.body;
}

async function createStoreWithProduct(seller: UserActor) {
  const suffix = uniqueSuffix();
  const profile = await expectOk("business profile", await callApi("POST", "/api/v1/users/me/business-profiles", { token: seller.accessToken, body: { displayName: `Load Store ${suffix}`, handle: `loadstore${suffix}`.slice(0, 30), description: "Load test", businessType: "business", categories: [{ customName: "Fashion" }] } }));
  const store = await expectOk("store", await callApi("POST", "/api/v1/stores", { token: seller.accessToken, body: { businessProfileId: profile.id, name: `Load Store ${suffix}`, description: "Load test", countryCode: "NG" } }));
  const headers = { "x-store-id": store.id };
  await expectOk("shipping", await callApi("POST", "/api/v1/seller/shipping/rules", { token: seller.accessToken, headers, body: { zoneName: "Nationwide", destinations: [{ level: "country", countryCode: "NG" }], type: "flat_fee", feeMinor: 100000, active: true } }));
  const locations = await expectOk("locations", await callApi("GET", "/api/v1/seller/locations", { token: seller.accessToken, headers }));
  const product = await expectOk("product", await callApi("POST", "/api/v1/seller/products", { token: seller.accessToken, headers, body: { name: `Load Shirt ${suffix}`, description: "load", status: "active", taxable: false, trackInventory: true, publishedOnline: true, tags: ["load"], options: [], imageMediaIds: [], variants: [{ optionValues: {}, sku: `LOAD-${suffix}`.toUpperCase(), priceMinor: 500_000, lowStockThreshold: 1, openingStock: [{ locationId: locations.data[0].id, quantity: 1_000_000 }] }] } }));
  return { storeId: store.id as string, productId: product.id as string, variantId: product.variants?.[0]?.id as string };
}

async function createBuyerAddress(buyer: UserActor): Promise<string> {
  const countries = await callApi("GET", "/api/v1/geo/countries");
  const nigeria = countries.body.data.find((country: { code: string }) => country.code === "NG");
  const regions = await callApi("GET", `/api/v1/geo/countries/${nigeria.id}/regions`);
  const lagos = regions.body.data.find((region: { name: string }) => /lagos/i.test(region.name)) ?? regions.body.data[0];
  const areas = await callApi("GET", `/api/v1/geo/regions/${lagos.id}/admin-areas`);
  const address = await expectOk("address", await callApi("POST", "/api/v1/users/me/addresses", { token: buyer.accessToken, body: { label: "Home", fullName: "Load Buyer", phone: "+2348012345678", line1: "4 Allen Avenue", countryId: nigeria.id, stateId: lagos.id, lgaId: areas.body.data[0].id, city: "Ikeja", isDefault: true } }));
  return address.id;
}

async function main(): Promise<void> {
  const staff = await createSuperadmin();
  const current = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
  await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: { ...current.body.value, autoApprove: { ...current.body.value.autoApprove, minimumAccountAgeDays: 0, minimumRealFollowers: 0, minimumOriginalPostsInLast60Days: 0 }, manualReview: { ...current.body.value.manualReview, minimumRealFollowers: 0 } }, expectedVersion: current.body.version, reason: "Load fixtures need an instant creator" } });
  let host = await registerUser("loadhost");
  await expectOk("creator application", await callApi("POST", "/api/v1/users/me/creator-application", { token: host.accessToken, body: {} }));
  const refreshed = await expectOk("refresh", await callApi("POST", "/api/v1/auth/refresh", { body: { refreshToken: host.refreshToken } }));
  host = { ...host, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };
  const after = await callApi("GET", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken });
  await callApi("PUT", "/api/v1/admin/config/creator-thresholds", { token: staff.accessToken, headers: { "x-step-up-token": await stepUpStaff(staff) }, body: { value: current.body.value, expectedVersion: after.body.version, reason: "Restore after load fixtures" } });
  const live = await expectOk("live", await callApi("POST", "/api/v1/lives", { token: host.accessToken, body: { title: "Load live", category: "justChatting", visibility: "public", startNow: true } }));
  const giftId = `load-rose-${uniqueSuffix()}`;
  await expectOk("gift", await callApi("POST", "/api/v1/admin/gifts", { token: staff.accessToken, body: { id: giftId, name: "Load Rose", tier: "basic", priceCoins: 1, animationEngine: "lottie", animationAssetKey: "gifts/rose.json", previewAssetKey: "gifts/rose.png", durationMs: 1000, displayLevel: "micro", comboable: true, isActive: true, sortOrder: 1 } }));
  const seller = await registerUser("loadseller");
  const store = await createStoreWithProduct(seller);
  await verifySellerBusiness(staff, seller);
  const users: Array<UserActor & { addressId: string }> = [];
  for (let index = 0; index < userCount; index += 1) {
    const user = await registerUser("loaduser");
    await callApi("POST", `/api/v1/users/${host.accountId}/follow`, { token: user.accessToken, body: {} });
    await callApi("POST", `/api/v1/lives/${live.id}/join`, { token: user.accessToken, body: {} });
    users.push({ ...user, addressId: await createBuyerAddress(user) });
  }
  const fixtures = { generatedAt: new Date().toISOString(), host, liveId: live.id, giftId, seller, store, users, intelligenceSecret: process.env["LOAD_INTELLIGENCE_SECRET"] ?? "local-only-intelligence-shared-secret-0123456789", paystackSecret: "sk_test_fake_paystack" };
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 1));
  console.log(`fixtures written to ${outputPath} (${users.length} users, live ${live.id}, product ${store.productId})`);
}

await main();
