import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import type { BlackApplicationSummary, GovernmentBlackBillingDashboard } from "@/types/verification.type";

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const call = <T>(method: string, path: string, body?: unknown) =>
  dispatchMockApiRequest(method, path, new URLSearchParams(), body === undefined ? null : encode(body)) as Promise<T>;
const failureOf = (request: Promise<unknown>) => request.then(() => undefined, (error: unknown) => error as { status: number; code?: string });

describe("government black verification and billing mocks", () => {
  it("runs government intake -> institutional email OTP -> private billing disclosure gating", async () => {
    const submitted = await call<{ applicationId: string; institutionalEmailVerificationRequired: boolean }>(
      "POST",
      "/api/v1/verification/black-applications",
      {
        agencyName: "Ministry of Digital Records",
        legalIdentityName: "Federal Ministry of Digital Records",
        jurisdictionCountryCode: "NG",
        institutionalEmail: "contact@digital.gov.ng",
        representativeName: "Ada Officer",
        representativeRole: "Director",
      },
    );
    assert.equal(submitted.institutionalEmailVerificationRequired, true);
    assert.ok(submitted.applicationId);

    const otpSent = await call<{ sent: boolean }>("POST", `/api/v1/verification/black-applications/${submitted.applicationId}/email/send-otp`, {});
    assert.equal(otpSent.sent, true);

    const verified = await call<BlackApplicationSummary>("POST", `/api/v1/verification/black-applications/${submitted.applicationId}/email/verify`, { code: "123456" });
    assert.equal(verified.institutionalEmailVerified, true);
    assert.equal(verified.status, "IN_REVIEW");

    // Pending/in-review applications must NOT disclose private Black pricing before two-admin approval.
    const dashboard = await call<GovernmentBlackBillingDashboard>("GET", "/api/v1/verification/black/billing");
    assert.equal(dashboard.pricing, null);
    assert.equal(dashboard.disclosures, null);

    const badOtp = await failureOf(call("POST", `/api/v1/verification/black-applications/${submitted.applicationId}/email/verify`, { code: "12" }));
    assert.equal(badOtp?.status, 400);
  });
});
