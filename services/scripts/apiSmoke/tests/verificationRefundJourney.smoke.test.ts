import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { createSuperadmin, stepUpStaff, type StaffActor, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { createStoreWithProduct, psql } from "../src/commerceFixtures.util.js";
import { payCheckoutThroughProvider, readProviderState } from "../src/fakeFlutterwave.util.js";
import { expectClearError, expectLedgerBalancedSince } from "../src/journeyChecks.util.js";

function caseOf(subscriptionId: string): Record<string, string> | undefined {
  const row = psql(`select id, status, coalesce(refund_status, '-'), '-' from users.verification_cases where subscription_id = '${subscriptionId}'`)[0];
  return row === undefined ? undefined : { id: row[0] ?? "", status: row[1] ?? "", refundStatus: row[2] ?? "", refundMethod: row[3] ?? "" };
}

describe("verification: a rejected application gets its money back, once", () => {
  let staff: StaffActor;
  let member: UserActor;

  beforeAll(async () => {
    staff = await createSuperadmin();
  });

  it("refunds the checkmark share when staff reject the identity check, keeps the plan, and refuses to reject twice", { timeout: 120_000 }, async () => {
    const web = { "x-client-platform": "web", "x-client-region": "NG", "x-device-id": `smoke-verify-${randomUUID()}` };
    const store = await createStoreWithProduct("edgeverify", 500_000);
    member = store.seller;
    const started = await callApi("POST", "/api/v1/seller/subscription/checkout", { token: member.accessToken, headers: web, body: { profileId: store.businessProfileId, planId: "seller_pro_monthly" } });
    expect(started.status, describeResponse(started)).toBe(201);
    const subscriptionId: string = started.body.subscriptionId;
    await payCheckoutThroughProvider(started.body.reference);
    const paidMinor = Number(psql(`select amount_minor from payments.payment_intents where reference = '${started.body.reference}'`)[0]?.[0]);
    const opened = await waitFor(async () => caseOf(subscriptionId), 30_000, 1000);
    expect(opened, "paying for Blue opens a verification case").toBeDefined();
    const refundsBefore = ((await readProviderState()).refunds ?? []).length;
    const headers = { "x-step-up-token": await stepUpStaff(staff) };
    const rejected = await callApi("POST", `/api/v1/admin/verification-cases/${opened!.id}/reject`, { token: staff.accessToken, headers, body: { reason: "The ID belongs to someone else." } });
    expect(rejected.status, describeResponse(rejected)).toBe(200);
    expect(rejected.body.status).toBe("rejected");
    expect(rejected.body.refundStatus, describeResponse(rejected)).toBe("requested");
    const twice = await callApi("POST", `/api/v1/admin/verification-cases/${opened!.id}/reject`, { token: staff.accessToken, headers, body: { reason: "Again" } });
    expectClearError(twice, [409, 422]);
    const refunded = await waitFor(async () => (((await readProviderState()).refunds ?? []).length > refundsBefore ? true : undefined), 45_000, 1000);
    expect(refunded, `the card was never refunded: ${JSON.stringify(caseOf(subscriptionId))}`).toBe(true);
    const settled = await waitFor(async () => (/refunded|succeeded/.test(caseOf(subscriptionId)?.refundStatus ?? "") ? caseOf(subscriptionId) : undefined), 30_000, 1000);
    expect(settled, `case refund status: ${JSON.stringify(caseOf(subscriptionId))}`).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect(((await readProviderState()).refunds ?? []).length - refundsBefore, "exactly one refund").toBe(1);
    const refundedMinor = Number(psql(`select coalesce(sum(r.amount_minor), 0) from payments.payment_refunds r join payments.payment_intents i on i.id = r.payment_intent_id where i.reference = '${started.body.reference}'`)[0]?.[0]);
    expect(refundedMinor, "only the checkmark share comes back").toBeGreaterThan(0);
    expect(refundedMinor).toBeLessThan(paidMinor);
    expect(psql(`select status from subscriptions.subscriptions where id = '${subscriptionId}'`)[0]?.[0], "the plan itself carries on").toBe("active");
    expectLedgerBalancedSince(15);
  });
});
