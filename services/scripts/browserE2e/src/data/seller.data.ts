import type { SeededStore } from "./commerce.data.js";
import { addDefaultAddress } from "./commerce.data.js";
import { callApi, describeResponse, payCheckoutThroughFakePaystack, registerUser, waitFor, type UserActor } from "../smokeBridge.js";

const web = { "x-client-platform": "web", "x-client-region": "NG" };

export async function upgradeToBusinessPlan(store: SeededStore): Promise<void> {
  const started = await callApi("POST", "/api/v1/seller/subscription/checkout", { token: store.seller.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_business_monthly" } });
  if (started.status !== 201) throw new Error(`plan checkout: ${describeResponse(started)}`);
  await payCheckoutThroughFakePaystack(started.body.reference);
  await waitFor(async () => {
    const current = await callApi("GET", "/api/v1/seller/subscription", { token: store.seller.accessToken, headers: { "X-Seller-Store": store.storeId } });
    return /business/.test(JSON.stringify(current.body ?? {})) ? true : undefined;
  }, 30_000, 1000);
}

export async function acceptTeamRequest(member: UserActor): Promise<void> {
  const pending = await waitFor(async () => {
    const list = await callApi("GET", "/api/v1/stores/team-requests", { token: member.accessToken });
    return list.body?.data?.[0]?.id ?? undefined;
  }, 15_000, 1000);
  if (pending === undefined) throw new Error("no team request arrived");
  const accepted = await callApi("POST", `/api/v1/stores/team-requests/${pending}/accept`, { token: member.accessToken, body: {} });
  if (accepted.status >= 300) throw new Error(`accept team request: ${describeResponse(accepted)}`);
}

export async function placePaidOrder(store: SeededStore): Promise<{ readonly buyer: UserActor; readonly orderId: string }> {
  const buyer = await registerUser("sellbuyer");
  const addressId = await addDefaultAddress(buyer);
  await callApi("POST", "/api/v1/cart/items", { token: buyer.accessToken, body: { productId: store.productId, variantId: store.variantId, quantity: 1 } });
  const placed = await callApi("POST", "/api/v1/orders/checkout", { token: buyer.accessToken, body: { addressId, paymentModes: [] } });
  if (placed.status >= 300) throw new Error(`checkout: ${describeResponse(placed)}`);
  const initialized = await callApi("POST", "/api/v1/payments/initialize", { token: buyer.accessToken, body: { orderId: placed.body.payableOrderId, provider: "paystack" } });
  if (initialized.status >= 300) throw new Error(`initialize: ${describeResponse(initialized)}`);
  await payCheckoutThroughFakePaystack(initialized.body.reference);
  const orderId: string = (placed.body.orders ?? placed.body.orderGroups ?? []).map((order: { id?: string; orderId?: string }) => order.id ?? order.orderId)[0];
  return { buyer, orderId };
}
