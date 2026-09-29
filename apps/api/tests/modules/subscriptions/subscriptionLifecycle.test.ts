import { afterAll, describe, expect, it } from "vitest";

import type { SignedInUser } from "../../fixtures/testApplication.fixture.js";
import { createCommerceTestApplication, createIdempotencyKey, FAKE_WEBHOOK_SECRET } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

const DAY = 86_400;

type Subscription = { status: string; plan: string; endsAt: string | null; autoRenew: boolean };

async function runRenewals(): Promise<void> {
  await app.dependencies.scheduledJobs.find((job) => job.id === "subscription-renewals")?.run();
}

async function signIn(user: SignedInUser): Promise<string> {
  const login = await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(200);
  return login.json<{ accessToken: string }>().accessToken;
}

async function mySubscription(user: SignedInUser): Promise<Subscription> {
  return (await app.client.get("/api/v1/subscriptions/me").auth(await signIn(user)).expect(200)).json<Subscription>();
}

async function subscribe(accessToken: string, plan = "PREMIUM", extra: Record<string, unknown> = {}) {
  const response = await app.client.post("/api/v1/subscriptions/checkout").auth(accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan, ...extra }).expect(201);
  return response.json<{ reference: string | null; authorizationUrl: string | null; callbackUrl: string | null; subscription: Subscription | null }>();
}

function sendWebhook(id: string, reference: string) {
  return app.client.post("/api/v1/payments/webhooks/paystack").set("x-fake-signature", FAKE_WEBHOOK_SECRET).send({ id, reference });
}

describe("personal subscription state machine", () => {
  it("runs trialing -> past_due (no card) -> expired after the grace period", async () => {
    const user = await app.registerUser();
    const trial = await subscribe(user.accessToken, "VERIFIED", { trial: true });
    expect(trial).toMatchObject({ authorizationUrl: null, reference: null, subscription: { status: "TRIALING" } });
    await app.client.post("/api/v1/subscriptions/checkout").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan: "VERIFIED", trial: true }).expect(409);
    app.clock.advanceBySeconds(7 * DAY + 60);
    await runRenewals();
    expect((await mySubscription(user)).status).toBe("PAST_DUE");
    app.clock.advanceBySeconds(2 * DAY);
    await runRenewals();
    expect((await mySubscription(user)).status).toBe("PAST_DUE");
    app.clock.advanceBySeconds(DAY + 60);
    await runRenewals();
    expect((await mySubscription(user)).status).toBe("EXPIRED");
  });

  it("activates only after provider verification and renews from the saved authorization", async () => {
    const user = await app.registerBuyer("NG");
    const checkout = await subscribe(user.accessToken, "PREMIUM", { returnTo: "https://seller.zudomart.test/payments/return" });
    expect(checkout.callbackUrl).toBe(`https://seller.zudomart.test/payments/return?reference=${checkout.reference}`);
    expect(app.paystack.initialized.at(-1)).toMatchObject({ amount: 900_000, currency: "NGN", callbackUrl: checkout.callbackUrl });
    await app.client.get("/api/v1/subscriptions/me").auth(user.accessToken).expect(404);
    expect(checkout).toMatchObject({ subscription: null });
    await app.client.post("/api/v1/subscriptions/checkout").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan: "PREMIUM", returnTo: "https://evil.example/steal" }).expect(422);
    const stranger = await app.registerUser();
    await app.client.post("/api/v1/subscriptions/verify").auth(stranger.accessToken).send({ reference: checkout.reference }).expect(404);
    const active = (await app.client.post("/api/v1/subscriptions/verify").auth(user.accessToken).send({ reference: checkout.reference }).expect(200)).json<Subscription>();
    expect(active.status).toBe("ACTIVE");
    await app.client.post("/api/v1/subscriptions/checkout").auth(user.accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan: "PREMIUM" }).expect(409);

    app.clock.advanceBySeconds(31 * DAY);
    await runRenewals();
    const renewed = await mySubscription(user);
    expect(renewed.status).toBe("ACTIVE");
    expect(new Date(renewed.endsAt ?? 0).getTime()).toBeGreaterThan(new Date(active.endsAt ?? 0).getTime());
    expect(app.paystack.savedAuthorizationCharges.filter((charge) => charge.email === user.email).at(-1)).toMatchObject({ authorization: `AUTH_${checkout.reference}`, amount: 900_000 });
  });

  it("marks a failed renewal past due, recovers through an idempotent webhook, and hides the badge while past due", async () => {
    const user = await app.registerUser();
    const admin = await app.registerAdmin();
    const checkout = await subscribe(user.accessToken, "VERIFIED");
    await app.client.post("/api/v1/subscriptions/verify").auth(user.accessToken).send({ reference: checkout.reference }).expect(200);
    await app.client.post("/api/v1/verification/apply").auth(user.accessToken).send({ profileType: "PERSONAL" }).expect(201);
    await app.client.post(`/api/v1/verification/${user.userId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ badgeVisible: true });

    app.paystack.savedAuthorizationChargeStatus = "failed";
    app.clock.advanceBySeconds(31 * DAY);
    await runRenewals();
    app.paystack.savedAuthorizationChargeStatus = "succeeded";
    expect((await mySubscription(user)).status).toBe("PAST_DUE");
    await app.client.get(`/api/v1/verification/${user.userId}`).expect(200).expectJson({ badgeVisible: false });

    app.clock.advanceBySeconds(DAY + 60);
    app.paystack.savedAuthorizationChargeStatus = "pending";
    await runRenewals();
    app.paystack.savedAuthorizationChargeStatus = "succeeded";
    const retry = app.paystack.savedAuthorizationCharges.filter((charge) => charge.email === user.email).at(-1)?.reference ?? "";
    await sendWebhook(`evt_${retry}`, retry).expect(200).expectJson({ duplicate: false });
    await sendWebhook(`evt_${retry}`, retry).expect(200).expectJson({ duplicate: true });
    await sendWebhook(`evt_again_${retry}`, retry).expect(200).expectJson({ duplicate: false });
    const recovered = await mySubscription(user);
    expect(recovered.status).toBe("ACTIVE");
    const renewals = (await app.client.get("/api/v1/admin/audit-events").query({ entityId: user.userId, action: "subscriptions.renewed" }).auth(await signIn(admin)).expect(200)).json<{ data: unknown[] }>();
    expect(renewals.data).toHaveLength(1);
    await app.client.get(`/api/v1/verification/${user.userId}`).expect(200).expectJson({ badgeVisible: true });
  });

  it("cancels at period end, resumes before the end, then expires once the period ends after another cancel", async () => {
    const user = await app.registerUser();
    const other = await app.registerUser();
    const checkout = await subscribe(user.accessToken, "ESSENTIAL");
    await app.client.post("/api/v1/subscriptions/verify").auth(user.accessToken).send({ reference: checkout.reference }).expect(200);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/cancel`).auth(other.accessToken).expect(404);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/cancel`).auth(user.accessToken).expect(200).expectJson({ status: "CANCELLED", autoRenew: false });
    await app.client.post(`/api/v1/subscriptions/${user.userId}/resume`).auth(user.accessToken).expect(200).expectJson({ status: "ACTIVE", autoRenew: true });
    await app.client.post(`/api/v1/subscriptions/${user.userId}/cancel`).auth(user.accessToken).expect(200);
    const chargesForUser = () => app.paystack.savedAuthorizationCharges.filter((charge) => charge.email === user.email).length;
    const chargesBefore = chargesForUser();
    app.clock.advanceBySeconds(32 * DAY);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/resume`).auth(await signIn(user)).expect(409);
    await runRenewals();
    expect(chargesForUser()).toBe(chargesBefore);
    expect((await mySubscription(user)).status).toBe("EXPIRED");
    await app.client.get(`/api/v1/subscriptions/${user.userId}`).expect(200).expectJson({ status: "EXPIRED", plan: "ESSENTIAL" });
  });

  it("lets admins suspend, reinstate and change plans following the allowed transitions", async () => {
    const user = await app.registerUser();
    const admin = await app.registerAdmin();
    const checkout = await subscribe(user.accessToken, "VERIFIED");
    await app.client.post("/api/v1/subscriptions/verify").auth(user.accessToken).send({ reference: checkout.reference }).expect(200);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/suspend`).auth(user.accessToken).expect(403);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/upgrade`).auth(admin.accessToken).send({ plan: "PREMIUM" }).expect(200).expectJson({ plan: "PREMIUM" });
    await app.client.post(`/api/v1/subscriptions/${user.userId}/upgrade`).auth(admin.accessToken).send({ plan: "ESSENTIAL" }).expect(409);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/upgrade`).auth(admin.accessToken).send({ plan: "PRO" }).expect(422);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/suspend`).auth(admin.accessToken).expect(200).expectJson({ status: "SUSPENDED" });
    await app.client.post(`/api/v1/subscriptions/${user.userId}/resume`).auth(user.accessToken).expect(409);
    await app.client.post(`/api/v1/subscriptions/${user.userId}/reinstate`).auth(admin.accessToken).expect(200).expectJson({ status: "ACTIVE" });
    const listed = (await app.client.get("/api/v1/subscriptions").query({ plan: "PREMIUM" }).auth(admin.accessToken).expect(200)).json<{ data: { profileId: string }[] }>();
    expect(listed.data.map((item) => item.profileId)).toContain(user.userId);
    await app.client.get("/api/v1/subscriptions").auth(user.accessToken).expect(403);
  });
});
