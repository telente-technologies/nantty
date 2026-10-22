import { execFileSync } from "node:child_process";
import { expect } from "vitest";

import { registerUser, stepUpUser, type UserActor } from "./actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "./apiClient.util.js";
import { uploadSampleImage } from "./mediaUpload.util.js";

export interface SmokeStore {
  readonly seller: UserActor;
  readonly storeId: string;
  readonly businessProfileId: string;
  readonly productId: string;
  readonly variantId: string;
  readonly productBody: Record<string, unknown>;
  readonly locationId: string;
}

export function psql(statement: string): string[][] {
  const output = execFileSync("docker", ["exec", "zudomart-backend-postgres-1", "psql", "-U", "zudomart", "-d", "zudomart", "-At", "-F", "|", "-c", statement], { encoding: "utf8" });
  return output.split("\n").filter((line) => line !== "" && !/^(UPDATE|INSERT|DELETE) \d+$/.test(line)).map((line) => line.split("|"));
}

export function approveSellerApplication(accountId: string): void {
  psql(`insert into catalog.seller_applications (id, created_at, updated_at, account_id, status, store_name, category_id, phone_sealed, address_line, city, state, identity_document_type, identity_document_number_sealed, identity_document_last4, identity_document_photo_url, payout_bank_code, payout_account_number_sealed, payout_account_last4)
    values (gen_random_uuid(), now(), now(), '${accountId}', 'approved', 'Smoke store', gen_random_uuid(), '\\x00', '4 Allen Avenue', 'Ikeja', 'Lagos', 'nin', '\\x00', '0000', 'https://cdn.test/id.jpg', '058', '\\x00', '0000')`);
}

export async function createStoreWithProduct(label: string, priceMinor: number, openingQuantity = 50): Promise<SmokeStore> {
  const suffix = uniqueSuffix();
  const seller = await registerUser(label);
  approveSellerApplication(seller.accountId);
  const profile = await callApi("POST", "/api/v1/users/me/business-profiles", { token: seller.accessToken, body: { displayName: `Smoke ${label} ${suffix}`, handle: `sm${label}${suffix}`.slice(0, 30), description: "Smoke store", businessType: "business", purpose: "store", categories: [{ customName: "Fashion" }] } });
  expect(profile.status, describeResponse(profile)).toBe(201);
  const businessProfileId: string = profile.body.id ?? profile.body.profile?.id;
  const store = await callApi("POST", "/api/v1/stores", { token: seller.accessToken, body: { businessProfileId, name: `Smoke ${label} ${suffix}`, description: "Smoke store", countryCode: "NG" } });
  expect(store.status, describeResponse(store)).toBe(201);
  const storeId: string = store.body.id ?? store.body.store?.id;
  return stockStoreWithProduct(seller, storeId, businessProfileId, label, priceMinor, openingQuantity);
}

export async function stockStoreWithProduct(seller: UserActor, storeId: string, businessProfileId: string, label: string, priceMinor: number, openingQuantity = 50): Promise<SmokeStore> {
  const suffix = uniqueSuffix();
  const headers = { "x-store-id": storeId, "x-seller-store": storeId };
  const rule = await callApi("POST", "/api/v1/seller/shipping/rules", { token: seller.accessToken, headers, body: { zoneName: "Nationwide", destinations: [{ level: "country", countryCode: "NG" }], type: "flat_fee", feeMinor: 150000, active: true } });
  expect([200, 201], describeResponse(rule)).toContain(rule.status);
  const locations = await callApi("GET", "/api/v1/seller/locations", { token: seller.accessToken, headers });
  const locationId = locations.body.data?.[0]?.id;
  const image = await uploadSampleImage(seller.accessToken, "product");
  const productBody = { name: `Smoke ${label} item ${suffix}`, description: "Smoke item", status: "active", taxable: false, trackInventory: true, publishedOnline: true, tags: ["smoke"], options: [], imageMediaIds: [image.mediaId], variants: [{ optionValues: {}, sku: `SM-${label}-${suffix}`.toUpperCase(), priceMinor, lowStockThreshold: 1, openingStock: locationId === undefined ? [] : [{ locationId, quantity: openingQuantity }] }] };
  const product = await callApi("POST", "/api/v1/seller/products", { token: seller.accessToken, headers, body: productBody });
  expect(product.status, describeResponse(product)).toBe(201);
  const productId: string = product.body.id ?? product.body.product?.id;
  const published = await waitFor(async () => ((await callApi("GET", `/api/v1/products/${productId}`)).status === 200 ? true : undefined), 10_000, 500);
  expect(published, "product never became public").toBeDefined();
  return { seller, storeId, businessProfileId, productId, variantId: product.body.variants?.[0]?.id ?? product.body.product?.variants?.[0]?.id, productBody, locationId };
}

export async function changeVariantPrice(store: SmokeStore, priceMinor: number): Promise<void> {
  const [variant] = store.productBody["variants"] as Record<string, unknown>[];
  const body = { ...store.productBody, variants: [{ ...variant, id: store.variantId, priceMinor, openingStock: [] }] };
  const changed = await callApi("PATCH", `/api/v1/seller/products/${store.productId}`, { token: store.seller.accessToken, headers: { "x-store-id": store.storeId, "x-seller-store": store.storeId }, body });
  expect(changed.status, describeResponse(changed)).toBe(200);
}

export async function adjustStock(store: SmokeStore, quantityDelta: number): Promise<void> {
  const adjusted = await callApi("POST", "/api/v1/seller/inventory/adjustments", { token: store.seller.accessToken, headers: { "x-store-id": store.storeId, "x-seller-store": store.storeId }, body: { locationId: store.locationId, reason: quantityDelta < 0 ? "damaged" : "received", lines: [{ variantId: store.variantId, quantityDelta }] } });
  expect([200, 201], describeResponse(adjusted)).toContain(adjusted.status);
}

export async function createBuyerWithAddress(): Promise<{ buyer: UserActor; addressId: string }> {
  const buyer = await registerUser("buyer");
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: buyer.accessToken, body: { countryCode: "NG" } });
  const countries = await callApi("GET", "/api/v1/geo/countries");
  const nigeria = countries.body.data.find((country: { code: string }) => country.code === "NG");
  const regions = await callApi("GET", `/api/v1/geo/countries/${nigeria.id}/regions`);
  const lagos = regions.body.data.find((region: { name: string }) => region.name.toLowerCase().includes("lagos")) ?? regions.body.data[0];
  const areas = await callApi("GET", `/api/v1/geo/regions/${lagos.id}/admin-areas`);
  const lga = areas.body.data.find((area: { name: string }) => /ikeja/i.test(area.name)) ?? areas.body.data[0];
  const address = await callApi("POST", "/api/v1/users/me/addresses", { token: buyer.accessToken, body: { label: "Home", fullName: "Smoke Buyer", phone: "+2348012345678", line1: "4 Allen Avenue", countryId: nigeria.id, stateId: lagos.id, lgaId: lga.id, city: "Ikeja", isDefault: true } });
  expect(address.status, describeResponse(address)).toBe(201);
  return { buyer, addressId: address.body.id };
}

export async function addToCart(buyer: UserActor, store: SmokeStore, quantity: number): Promise<void> {
  const added = await callApi("POST", "/api/v1/cart/items", { token: buyer.accessToken, body: { productId: store.productId, variantId: store.variantId, quantity } });
  expect([200, 201], describeResponse(added)).toContain(added.status);
}

export async function checkout(buyer: UserActor, addressId: string, paymentModes: Record<string, "escrow" | "direct"> = {}): Promise<{ checkoutId: string; orderIds: string[]; body: any }> {
  const choices = Object.entries(paymentModes).map(([storeId, paymentMode]) => ({ storeId, paymentMode }));
  const response = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId, paymentModes: choices, directPaymentAccepted: Object.values(paymentModes).includes("direct") } });
  expect([200, 201], describeResponse(response)).toContain(response.status);
  const body = response.body;
  const orderIds: string[] = (body.orders ?? body.orderGroups ?? []).map((order: { id?: string; orderId?: string }) => order.id ?? order.orderId);
  return { checkoutId: body.checkoutId ?? body.checkout?.id ?? body.id, orderIds, body };
}

export async function shipAndDeliver(store: SmokeStore, orderId: string): Promise<void> {
  const headers = { "x-store-id": store.storeId, "x-seller-store": store.storeId };
  const accepted = await waitFor(async () => {
    const response = await callApi("POST", `/api/v1/seller/orders/${orderId}/accept`, { token: store.seller.accessToken, headers, body: {} });
    return response.status === 409 ? undefined : response;
  }, 20_000, 1000);
  expect([200, 201, 204], accepted === undefined ? "order never became acceptable" : describeResponse(accepted)).toContain(accepted?.status);
  const locations = await callApi("GET", "/api/v1/seller/locations", { token: store.seller.accessToken, headers });
  const fulfilled = await callApi("POST", `/api/v1/seller/orders/${orderId}/fulfilment`, { token: store.seller.accessToken, headers, body: { courier: "GIG Logistics", trackingNumber: `TRK${uniqueSuffix()}`, fromLocationId: locations.body.data?.[0]?.id } });
  expect([200, 201], describeResponse(fulfilled)).toContain(fulfilled.status);
  const delivered = await callApi("POST", `/api/v1/seller/orders/${orderId}/status`, { token: store.seller.accessToken, headers, body: { status: "delivered" } });
  expect([200, 201], describeResponse(delivered)).toContain(delivered.status);
}

export function bankAccountNumberFor(accountId: string): string {
  let hash = 2166136261;
  for (const character of accountId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return `2${String(hash % 1_000_000_000).padStart(9, "0")}`;
}

export async function onboardPayoutAccount(seller: UserActor, role?: "seller"): Promise<void> {
  await callApi("PATCH", "/api/v1/users/me/preferences", { token: seller.accessToken, body: { countryCode: "NG" } });
  const accountNumber = bankAccountNumberFor(seller.accountId);
  const identity = await callApi("PUT", `/api/v1/payments/payout-onboarding/me/identity${role === undefined ? "" : `?role=${role}`}`, { token: seller.accessToken, body: { legalName: "Temitope Adeyemi", dateOfBirth: "1994-02-03", addressLine1: "4 Allen Avenue", city: "Ikeja", state: "Lagos", idType: "bvn", idNumber: "22212345678", registeredBusiness: false } });
  expect([200, 201], describeResponse(identity)).toContain(identity.status);
  const resolved = await callApi("POST", "/api/v1/payments/payout-onboarding/me/resolve", { token: seller.accessToken, body: { bankCode: "058", accountNumber } });
  expect(resolved.status, describeResponse(resolved)).toBe(200);
  const bank = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/bank", { token: seller.accessToken, headers: { "x-step-up-token": await stepUpUser(seller) }, body: { bankCode: "058", bankName: "Guaranty Trust Bank", accountNumber, resolvedAccountName: resolved.body.accountName ?? "Temitope Adeyemi" } });
  expect([200, 201], describeResponse(bank)).toContain(bank.status);
  const validation = await callApi("POST", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: seller.accessToken });
  expect([200, 201, 202], describeResponse(validation)).toContain(validation.status);
  const verified = await waitFor(async () => {
    const state = await callApi("GET", "/api/v1/payments/payout-onboarding/me/bank-validation", { token: seller.accessToken });
    return state.body?.status === "verified" ? state : undefined;
  }, 30_000, 1000);
  expect(verified, "the BVN consent never verified").toBeDefined();
  const level = await waitFor(async () => {
    const view = await callApi("GET", "/api/v1/payments/verification/me", { token: seller.accessToken });
    return view.body?.level >= 1 ? view : undefined;
  }, 90_000, 2000);
  expect(level, "the seller never reached verification level 1").toBeDefined();
  const wallet = await callApi("POST", "/api/v1/payments/wallet/me/activate", { token: seller.accessToken });
  expect([200, 201, 409], describeResponse(wallet)).toContain(wallet.status);
}
