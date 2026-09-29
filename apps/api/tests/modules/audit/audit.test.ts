import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface AuditPage {
  readonly data: { readonly id: string; readonly action: string; readonly entityId: string }[];
}

describe("audit log", () => {
  it("records password resets and lets admins list and read them", async () => {
    const user = await app.registerUser();
    const admin = await app.registerAdmin();
    await app.client.post("/api/v1/auth/otp/send").send({ destination: user.email, purpose: "reset" }).expect(200);
    const code = app.oneTimeCodes.latestCodeFor(user.email, "reset_password");
    const verified = await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, code, purpose: "reset" }).expect(200);
    await app.client.post("/api/v1/auth/password/reset").send({ otpToken: verified.json<{ otpToken: string }>().otpToken, password: "Another-pass-9" }).expect(204);

    const page = await app.client.get("/api/v1/admin/audit-events").query({ entityType: "user", entityId: user.userId }).auth(admin.accessToken).expect(200);
    const events = page.json<AuditPage>().data;
    expect(events.map((event) => event.action)).toEqual(["auth.password_reset"]);
    await app.client.get(`/api/v1/admin/audit-events/${events[0]?.id ?? ""}`).auth(admin.accessToken).expect(200).expectJson({ entityId: user.userId });
  });

  it("forbids non-admins", async () => {
    const buyer = await app.registerUser();
    await app.client.get("/api/v1/admin/audit-events").auth(buyer.accessToken).expect(403);
    await app.client.get("/api/v1/admin/audit-events").expect(401);
  });
});
