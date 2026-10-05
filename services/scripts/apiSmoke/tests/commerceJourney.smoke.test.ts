import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix, waitFor } from "../src/apiClient.util.js";
import { bankAccountNumberFor } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughFakePaystack, readFakePaystackState, settleTransferThroughFakePaystack } from "../src/fakePaystack.util.js";
import { uploadSampleImage } from "../src/mediaUpload.util.js";
import { isListEnvelope } from "../src/smokeReport.util.js";

describe("commerce journey: seller onboarding → product → cart → checkout → escrow → delivered → release → payout", () => {
  let seller: UserActor;
  let buyer: UserActor;
  let storeId = "";
  let productId = "";
  let variantId = "";
  let addressId = "";
  let checkoutId = "";
  let orderId = "";
  let paymentReference = "";
  let orderTotalMinor = 0;
  const suffix = uniqueSuffix();

  beforeAll(async () => {
    seller = await registerUser("seller");
    buyer = await registerUser("buyer");
  });

  it("creates a business profile and a store", async () => {
    const profile = await callApi("POST", "/api/v1/users/me/business-profiles", { token: seller.accessToken, body: { displayName: `Smoke Store ${suffix}`, handle: `smokestore${suffix}`.slice(0, 30), description: "Smoke test store", businessType: "business", categories: [{ customName: "Fashion" }] } });
    expect(profile.status, describeResponse(profile)).toBe(201);
    const businessProfileId = profile.body.id ?? profile.body.profile?.id;
    const store = await callApi("POST", "/api/v1/stores", { token: seller.accessToken, body: { businessProfileId, name: `Smoke Store ${suffix}`, description: "Smoke test store", countryCode: "NG" } });
    expect(store.status, describeResponse(store)).toBe(201);
    storeId = store.body.id ?? store.body.store?.id;
    const access = await callApi("GET", "/api/v1/seller/access", { token: seller.accessToken });
    expect(access.status, describeResponse(access)).toBe(200);
    expect(JSON.stringify(access.body)).toContain(storeId);
  });

  it("refuses seller routes for a customer without a store", async () => {
    const response = await callApi("GET", "/api/v1/seller/products", { token: buyer.accessToken });
    expect([403, 404], describeResponse(response)).toContain(response.status);
  });

  it("sets up shipping and a location, then lists a product with stock", async () => {
    const rule = await callApi("POST", "/api/v1/seller/shipping/rules", { token: seller.accessToken, headers: { "x-store-id": storeId }, body: { zoneName: "Nationwide", destinations: [{ level: "country", countryCode: "NG" }], type: "flat_fee", feeMinor: 150000, active: true } });
    expect([200, 201], describeResponse(rule)).toContain(rule.status);
    const locations = await callApi("GET", "/api/v1/seller/locations", { token: seller.accessToken, headers: { "x-store-id": storeId } });
    expect(locations.status, describeResponse(locations)).toBe(200);
    const locationId = locations.body.data?.[0]?.id;
    const image = await uploadSampleImage(seller.accessToken, "product");
    const product = await callApi("POST", "/api/v1/seller/products", {
      token: seller.accessToken,
      headers: { "x-store-id": storeId },
      body: {
        name: `Smoke Ankara Shirt ${suffix}`, description: "A smoke test shirt", status: "active", taxable: false, trackInventory: true, publishedOnline: true, tags: ["smoke"], options: [],
        imageMediaIds: [image.mediaId], variants: [{ optionValues: {}, sku: `SMOKE-${suffix}`.toUpperCase(), priceMinor: 1_250_000, lowStockThreshold: 1, openingStock: locationId === undefined ? [] : [{ locationId, quantity: 10 }] }],
      },
    });
    expect(product.status, describeResponse(product)).toBe(201);
    productId = product.body.id ?? product.body.product?.id;
    variantId = product.body.variants?.[0]?.id ?? product.body.product?.variants?.[0]?.id;
    expect(productId).toBeTruthy();
    const published = await waitFor(async () => {
      const response = await callApi("GET", `/api/v1/products/${productId}`);
      return response.status === 200 ? response : undefined;
    }, 10_000, 500);
    expect(published, "product never became publicly readable").toBeDefined();
  });

  it("adds the product to the buyer's cart and quotes shipping", async () => {
    const countries = await callApi("GET", "/api/v1/geo/countries");
    const nigeria = countries.body.data.find((country: { code: string }) => country.code === "NG");
    const regions = await callApi("GET", `/api/v1/geo/countries/${nigeria.id}/regions`);
    const lagos = regions.body.data.find((region: { name: string }) => region.name.toLowerCase().includes("lagos")) ?? regions.body.data[0];
    const areas = await callApi("GET", `/api/v1/geo/regions/${lagos.id}/admin-areas`);
    const lga = areas.body.data.find((area: { name: string }) => /ikeja/i.test(area.name)) ?? areas.body.data[0];
    const address = await callApi("POST", "/api/v1/users/me/addresses", { token: buyer.accessToken, body: { label: "Home", fullName: "Smoke Buyer", phone: "+2348012345678", line1: "4 Allen Avenue", countryId: nigeria.id, stateId: lagos.id, lgaId: lga.id, city: "Ikeja", isDefault: true } });
    expect(address.status, describeResponse(address)).toBe(201);
    addressId = address.body.id;
    const added = await callApi("POST", "/api/v1/cart/items", { token: buyer.accessToken, body: { productId, variantId, quantity: 2 } });
    expect([200, 201], describeResponse(added)).toContain(added.status);
    const cart = await callApi("GET", "/api/v1/cart", { token: buyer.accessToken });
    expect(cart.status, describeResponse(cart)).toBe(200);
    expect(JSON.stringify(cart.body)).toContain(productId);
    const quote = await callApi("POST", "/api/v1/cart/shipping-quote", { token: buyer.accessToken, body: { addressId } });
    expect(quote.status, describeResponse(quote)).toBe(200);
  });

  it("checks out and pays through the provider fake", async () => {
    const checkout = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId } });
    expect([200, 201], describeResponse(checkout)).toContain(checkout.status);
    checkoutId = checkout.body.checkoutId ?? checkout.body.checkout?.id ?? checkout.body.id;
    orderId = checkout.body.orders?.[0]?.id ?? checkout.body.orderIds?.[0] ?? checkout.body.orderGroups?.[0]?.orderId;
    expect(checkoutId, describeResponse(checkout)).toBeTruthy();
    const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { checkoutId } });
    expect(initialized.status, describeResponse(initialized)).toBe(201);
    paymentReference = initialized.body.reference;
    orderTotalMinor = initialized.body.payment?.amount?.amountMinor ?? 0;
    expect(orderTotalMinor).toBeGreaterThanOrEqual(2_500_000);
    await payCheckoutThroughFakePaystack(paymentReference);
    const paid = await waitFor(async () => {
      const orders = await callApi("GET", "/api/v1/orders", { token: buyer.accessToken });
      expect(isListEnvelope(orders.body), describeResponse(orders)).toBe(true);
      const order = orders.body.data.find((candidate: { id: string; paymentStatus?: string; status?: string }) => candidate.id === orderId || orderId === undefined);
      if (order !== undefined && orderId === undefined) orderId = order.id;
      return order !== undefined && /paid|processing|placed|confirmed|pending_acceptance|awaiting/i.test(JSON.stringify(order)) && !/unpaid|awaiting_payment/i.test(order.paymentStatus ?? "") ? order : undefined;
    }, 20_000, 500);
    expect(paid, "order never showed as paid").toBeDefined();
  });

  it("holds the payment in escrow", async () => {
    const escrow = await waitFor(async () => {
      const response = await callApi("GET", `/api/v1/orders/${orderId}/escrow`, { token: buyer.accessToken });
      return response.status === 200 && /held|funded/i.test(JSON.stringify(response.body)) ? response : undefined;
    }, 15_000, 500);
    expect(escrow, "escrow was never funded").toBeDefined();
    const sellerOrders = await callApi("GET", "/api/v1/seller/orders", { token: seller.accessToken, headers: { "x-store-id": storeId } });
    expect(JSON.stringify(sellerOrders.body), describeResponse(sellerOrders)).toContain(orderId);
  });

  it("lets the seller accept, ship and deliver, and the buyer confirm receipt", async () => {
    const accepted = await callApi("POST", `/api/v1/seller/orders/${orderId}/accept`, { token: seller.accessToken, headers: { "x-store-id": storeId }, body: {} });
    expect([200, 201, 204], describeResponse(accepted)).toContain(accepted.status);
    const locations = await callApi("GET", "/api/v1/seller/locations", { token: seller.accessToken, headers: { "x-store-id": storeId } });
    const fulfilled = await callApi("POST", `/api/v1/seller/orders/${orderId}/fulfilment`, { token: seller.accessToken, headers: { "x-store-id": storeId }, body: { courier: "GIG Logistics", trackingNumber: `TRK${suffix}`, fromLocationId: locations.body.data?.[0]?.id } });
    expect([200, 201], describeResponse(fulfilled)).toContain(fulfilled.status);
    const delivered = await callApi("POST", `/api/v1/seller/orders/${orderId}/status`, { token: seller.accessToken, headers: { "x-store-id": storeId }, body: { status: "delivered" } });
    expect([200, 201], describeResponse(delivered)).toContain(delivered.status);
    const confirmed = await callApi("POST", `/api/v1/orders/${orderId}/confirm-receipt`, { token: buyer.accessToken, body: {} });
    expect([200, 201], describeResponse(confirmed)).toContain(confirmed.status);
    const released = await waitFor(async () => {
      const response = await callApi("GET", `/api/v1/orders/${orderId}/escrow`, { token: buyer.accessToken });
      return /released/i.test(JSON.stringify(response.body)) ? response : undefined;
    }, 15_000, 500);
    expect(released, "escrow was never released").toBeDefined();
  });

  it("onboards the seller for payouts and pays out the released funds", async () => {
    const identity = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/identity", { token: seller.accessToken, body: { legalName: "Temitope Adeyemi", dateOfBirth: "1994-02-03", addressLine1: "4 Allen Avenue", city: "Ikeja", state: "Lagos", idType: "bvn", idNumber: "22212345678", registeredBusiness: false } });
    expect([200, 201], describeResponse(identity)).toContain(identity.status);
    const resolved = await callApi("POST", "/api/v1/payments/payout-onboarding/me/resolve", { token: seller.accessToken, body: { bankCode: "058", accountNumber: bankAccountNumberFor(seller.accountId) } });
    expect(resolved.status, describeResponse(resolved)).toBe(200);
    const bank = await callApi("PUT", "/api/v1/payments/payout-onboarding/me/bank", { token: seller.accessToken, body: { bankCode: "058", bankName: "Guaranty Trust Bank", accountNumber: bankAccountNumberFor(seller.accountId), resolvedAccountName: resolved.body.accountName ?? "Temitope Adeyemi" } });
    expect([200, 201], describeResponse(bank)).toContain(bank.status);
    const wallet = await waitFor(async () => {
      const response = await callApi("GET", "/api/v1/wallets/me", { token: seller.accessToken, headers: { "x-client-region": "NG" } });
      return response.status === 200 && /"amountMinor":[1-9]/.test(JSON.stringify(response.body)) ? response : undefined;
    }, 30_000, 1000);
    expect(wallet, "seller wallet never showed the released funds").toBeDefined();
    const accounts = await callApi("GET", "/api/v1/wallets/me/payout-accounts", { token: seller.accessToken });
    expect(accounts.status, describeResponse(accounts)).toBe(200);
    const state = await readFakePaystackState();
    expect(state.transactions).toBeGreaterThan(0);
    for (const transfer of Object.values(state.transfers)) if (transfer.Status === "pending" || transfer.Status === "otp") await settleTransferThroughFakePaystack(transfer.Reference);
  });
});
