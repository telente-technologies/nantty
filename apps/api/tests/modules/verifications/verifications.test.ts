import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { encryptVerificationDetails, maskVerificationDetails } from "../../../src/modules/verifications/services/verificationDetails.service.js";
import { FieldCipher } from "../../../src/utils/crypto.util.js";
import { createCommerceTestApplication, createIdempotencyKey } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

type VerificationBody = { status: string; color: string; tier: string | null; badgeVisible: boolean; details: Record<string, unknown> | null };

async function subscribePersonal(accessToken: string, plan: "ESSENTIAL" | "VERIFIED" | "PREMIUM") {
  const checkout = await app.client.post("/api/v1/subscriptions/checkout").auth(accessToken).set("idempotency-key", createIdempotencyKey()).send({ plan }).expect(201);
  await app.client.post("/api/v1/subscriptions/verify").auth(accessToken).send({ reference: checkout.json<{ reference: string }>().reference }).expect(200);
}

function apply(accessToken: string, body: Record<string, unknown>) {
  return app.client.post("/api/v1/verification/apply").auth(accessToken).send(body);
}

describe("KYC details", () => {
  it("encrypts identity and registration numbers and only ever exposes masked values", async () => {
    const cipher = new FieldCipher(new Uint8Array(randomBytes(32)));
    const details = await encryptVerificationDetails(cipher, { legalName: "Ada Ventures Ltd", registrationNumber: "RC1234567", idType: "nin", idNumber: "12345678901", contactPhone: "08031234567" });
    expect(details.idNumberEncrypted).not.toContain("12345678901");
    expect(await cipher.decryptText(details.idNumberEncrypted ?? "")).toBe("12345678901");
    expect(await cipher.decryptText(details.registrationNumberEncrypted ?? "")).toBe("RC1234567");
    expect(maskVerificationDetails(details)).toMatchObject({ idNumber: "******8901", registrationNumber: "******4567", contactPhone: "******4567" });

    const user = await app.registerUser();
    const documentId = randomUUID();
    const response = await apply(user.accessToken, { profileType: "PERSONAL", details: { legalName: "Ada Obi", idType: "nin", idNumber: "12345678901", documentMediaIds: [documentId] } }).expect(201);
    expect(response.text).not.toContain("12345678901");
    expect(response.json<VerificationBody>()).toMatchObject({ status: "PENDING", color: "BLUE", details: { idNumber: "******8901", documentMediaIds: [documentId] } });
  });
});

describe("verification lifecycle", () => {
  it("follows the review state machine and audits every review", async () => {
    const user = await app.registerUser();
    const admin = await app.registerAdmin();
    await apply(user.accessToken, { profileType: "PERSONAL" }).expect(201);
    await apply(user.accessToken, { profileType: "PERSONAL" }).expect(409);
    await app.client.post(`/api/v1/verification/${user.userId}/approve`).auth(user.accessToken).send({}).expect(403);
    await app.client.post(`/api/v1/verification/${user.userId}/reject`).auth(admin.accessToken).send({}).expect(422);
    await app.client.post(`/api/v1/verification/${user.userId}/reject`).auth(admin.accessToken).send({ reason: "Blurry document" }).expect(200).expectJson({ status: "UNVERIFIED", reason: "Blurry document" });
    await app.client.post(`/api/v1/verification/${user.userId}/suspend`).auth(admin.accessToken).send({ reason: "x" }).expect(409);
    await apply(user.accessToken, { profileType: "PERSONAL" }).expect(201);
    const pending = (await app.client.get("/api/v1/verification").query({ status: "PENDING" }).auth(admin.accessToken).expect(200)).json<{ data: { profileId: string }[] }>();
    expect(pending.data.map((item) => item.profileId)).toContain(user.userId);
    await app.client.post(`/api/v1/verification/${user.userId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ status: "VERIFIED", badgeVisible: false });
    await app.client.post(`/api/v1/verification/${user.userId}/suspend`).auth(admin.accessToken).send({ reason: "Impersonation report" }).expect(200).expectJson({ status: "SUSPENDED" });
    await app.client.post(`/api/v1/verification/${user.userId}/revoke`).auth(admin.accessToken).send({ reason: "Confirmed fraud" }).expect(200).expectJson({ status: "REVOKED" });
    const audit = (await app.client.get("/api/v1/admin/audit-events").query({ entityId: user.userId, entityType: "profile_verification" }).auth(admin.accessToken).expect(200)).json<{ data: { action: string }[] }>();
    expect(audit.data.map((event) => event.action)).toEqual(expect.arrayContaining(["verifications.applied", "verifications.rejected", "verifications.approved", "verifications.suspended", "verifications.revoked"]));
  });

  it("shows the badge only for VERIFIED+ tiers backed by a subscription, and hides it when the subscription lapses", async () => {
    const essential = await app.registerUser();
    const verified = await app.registerUser();
    const admin = await app.registerAdmin();
    await apply(verified.accessToken, { profileType: "PERSONAL", tier: "VERIFIED" }).expect(422);
    await subscribePersonal(essential.accessToken, "ESSENTIAL");
    await subscribePersonal(verified.accessToken, "VERIFIED");
    await apply(essential.accessToken, { profileType: "PERSONAL" }).expect(201).expectJson({ tier: "ESSENTIAL" });
    await apply(verified.accessToken, { profileType: "PERSONAL", tier: "VERIFIED" }).expect(201);
    await app.client.post(`/api/v1/verification/${essential.userId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ badgeVisible: false });
    await app.client.post(`/api/v1/verification/${verified.userId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ badgeVisible: true, color: "BLUE", tier: "VERIFIED" });
    const publicProfile = (await app.client.get(`/api/v1/users/${verified.userId}`).expect(200)).json<{ verification: unknown }>();
    expect(publicProfile.verification).toEqual({ status: "VERIFIED", type: "PERSONAL", color: "BLUE", tier: "VERIFIED", badgeVisible: true });
    await app.client.post(`/api/v1/subscriptions/${verified.userId}/cancel`).auth(verified.accessToken).expect(200).expectJson({ status: "CANCELLED" });
    await app.client.get(`/api/v1/verification/${verified.userId}`).expect(200).expectJson({ status: "VERIFIED", badgeVisible: false });
    await app.client.post(`/api/v1/subscriptions/${verified.userId}/resume`).auth(verified.accessToken).expect(200).expectJson({ status: "ACTIVE" });
    await app.client.get(`/api/v1/verification/${verified.userId}`).expect(200).expectJson({ badgeVisible: true });
  });

  it("never lets a profile update set verification, and keeps government verification out of paid plans", async () => {
    const user = await app.registerUser();
    await app.client.patch("/api/v1/users/me").auth(user.accessToken).send({ name: "Still Me", verification: { status: "VERIFIED", badgeVisible: true }, verified: true }).expect(200);
    const me = (await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(200)).json<{ verification: { status: string; badgeVisible: boolean } }>();
    expect(me.verification).toMatchObject({ status: "UNVERIFIED", badgeVisible: false });
    await app.client.get("/api/v1/verification/me").auth(user.accessToken).expect(404);
    await apply(user.accessToken, { profileType: "GOVERNMENT", tier: "PREMIUM" }).expect(422);
    await apply(user.accessToken, { profileType: "GOVERNMENT" }).expect(201).expectJson({ color: "BLACK", tier: "OFFICIAL" });
    const admin = await app.registerAdmin();
    await app.client.post(`/api/v1/verification/${user.userId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ badgeVisible: true });
  });
});
