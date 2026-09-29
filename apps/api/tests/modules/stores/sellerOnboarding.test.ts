import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { createCommerceTestApplication } from "../orders/commerceSetup.fixture.js";

const app = createCommerceTestApplication();
afterAll(() => app.close());

const onboarding = {
  storeName: "Ada Fabrics",
  phone: "08031234567",
  business: { legalName: "Ada Fabrics Ltd", businessAddress: "12 Allen Avenue, Ikeja", registrationNumber: "RC7654321" },
  identity: { idType: "nin", idNumber: "12345678901", documentMediaIds: [randomUUID()] },
  payoutAccount: { bankCode: "058", accountNumber: "0123456789", accountName: "Ada Fabrics Ltd" },
};

describe("multi-step seller application", () => {
  it("keeps the simple application working", async () => {
    const applicant = await app.registerBuyer();
    await app.client.post("/api/v1/seller/applications").auth(applicant.accessToken).send({ storeName: "Simple Shop", phone: "08030000000" }).expect(201).expectJson({ onboarding: null });
  });

  it("validates the payout bank, masks KYC details, and creates the store's Gold verification and payout account on approval", async () => {
    const applicant = await app.registerBuyer("NG");
    await app.client.post("/api/v1/seller/applications").auth(applicant.accessToken).send({ ...onboarding, payoutAccount: { ...onboarding.payoutAccount, bankCode: "999" } }).expect(422);
    const submitted = await app.client.post("/api/v1/seller/applications").auth(applicant.accessToken).send(onboarding).expect(201);
    expect(submitted.text).not.toContain("12345678901");
    expect(submitted.text).not.toContain("0123456789");
    const application = submitted.json<{ id: string; onboarding: unknown }>();
    expect(application.onboarding).toMatchObject({
      verification: { legalName: "Ada Fabrics Ltd", registrationNumber: "******4321", idNumber: "******8901", idType: "nin" },
      payoutAccount: { bankName: "Guaranty Trust Bank", accountNumber: "******6789" },
    });

    const admin = await app.registerAdmin();
    await app.client.post(`/api/v1/admin/seller-applications/${application.id}/review`).auth(admin.accessToken).send({ decision: "approve" }).expect(200);
    const login = await app.client.post("/api/v1/auth/login").send({ identifier: applicant.email, password: applicant.password }).expect(200);
    const token = login.json<{ accessToken: string }>().accessToken;
    const verification = (await app.client.get("/api/v1/seller/verification").auth(token).expect(200)).json<{ profileId: string; status: string; color: string; details: Record<string, unknown> }>();
    expect(verification).toMatchObject({ status: "PENDING", color: "GOLD", details: { idNumber: "******8901", businessAddress: "12 Allen Avenue, Ikeja" } });
    const accounts = (await app.client.get(`/api/v1/wallets/me/payout-accounts?storeId=${verification.profileId}`).auth(token).expect(200)).json<{ accountNumber: string; isDefault: boolean }[]>();
    expect(accounts).toEqual([expect.objectContaining({ accountNumber: "******6789", isDefault: true })]);
    await app.client.post(`/api/v1/verification/${verification.profileId}/approve`).auth(admin.accessToken).send({}).expect(200).expectJson({ status: "VERIFIED", badgeVisible: false });
    await app.client.post("/api/v1/seller/verification").auth(token).send({ details: { legalName: "Again" } }).expect(409);
  });
});
