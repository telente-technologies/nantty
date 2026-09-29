import type { SignedInUser } from "../../fixtures/testApplication.fixture.js";
import { createCommerceTestApplication, createIdempotencyKey, FAKE_WEBHOOK_SECRET } from "../orders/commerceSetup.fixture.js";

export type CommerceTestApplication = ReturnType<typeof createCommerceTestApplication>;

export async function readCoinBalance(app: CommerceTestApplication, user: SignedInUser): Promise<{ coins: number; earnedCoins: number }> {
  return (await app.client.get("/api/v1/coins/balance").auth(user.accessToken).expect(200)).json<{ coins: number; earnedCoins: number }>();
}

export async function startCoinPurchase(app: CommerceTestApplication, user: SignedInUser, packId = "coins-700") {
  const response = await app.client.post("/api/v1/coins/purchases").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ packId }).expect(201);
  return response.json<{ reference: string; purchaseChannel: string; authorizationUrl: string | null; callbackUrl: string | null }>();
}

export async function buyCoins(app: CommerceTestApplication, user: SignedInUser, packId = "coins-700"): Promise<number> {
  const started = await startCoinPurchase(app, user, packId);
  await app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send({ id: `evt_${started.reference}`, reference: started.reference }).expect(200);
  return (await readCoinBalance(app, user)).coins;
}
