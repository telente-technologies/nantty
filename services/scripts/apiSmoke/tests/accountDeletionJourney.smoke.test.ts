import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse, waitFor } from "../src/apiClient.util.js";
import { psql } from "../src/commerceFixtures.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";

function pendingDeletion(accountId: string): string[] | undefined {
  return psql(`select id, status, extract(epoch from (scheduled_for - created_at))::bigint from users.deletion_requests where account_id = '${accountId}' order by created_at desc limit 1`)[0];
}

describe("deleting an account, changing your mind within 30 days, and what happens after", () => {
  let member: UserActor;
  let postId = "";

  beforeAll(async () => {
    member = await registerUser("edgeleaver");
    const post = await callApi("POST", "/api/v1/posts", { token: member.accessToken, body: { text: "Still here", audience: "everyone" } });
    expect(post.status, describeResponse(post)).toBe(201);
    postId = post.body.id;
  });

  it("asks for confirmation, schedules the deletion 30 days out, and refuses a second request", async () => {
    const unconfirmed = await callApi("POST", "/api/v1/users/me/deletion-request", { token: member.accessToken, body: { confirm: false, reason: "" } });
    expectClearError(unconfirmed, [400, 422]);
    expect(pendingDeletion(member.accountId), "nothing scheduled without confirmation").toBeUndefined();
    const requested = await callApi("POST", "/api/v1/users/me/deletion-request", { token: member.accessToken, body: { confirm: true, reason: "Taking a break" } });
    expect([200, 201, 202], describeResponse(requested)).toContain(requested.status);
    const [, status, graceSeconds] = pendingDeletion(member.accountId) ?? [];
    expect(status).toBe("pending");
    expect(Number(graceSeconds)).toBe(30 * 24 * 3600);
    const again = await callApi("POST", "/api/v1/users/me/deletion-request", { token: member.accessToken, body: { confirm: true, reason: "Again" } });
    expectClearError(again, [409, 422]);
  });

  it("cancels the deletion when the person signs back in within 30 days, with a notice", async () => {
    const login = await callApi("POST", "/api/v1/auth/login", { body: { identifier: member.email, password: "Sm0ke-Test-Pass!2026" } });
    expect(login.status, describeResponse(login)).toBe(200);
    expect(JSON.stringify(login.body), "the app is told the deletion was cancelled").toMatch(/deletion has been cancelled/i);
    member = { ...member, accessToken: login.body.accessToken, refreshToken: login.body.refreshToken };
    const state = await waitFor(async () => (pendingDeletion(member.accountId)?.[1] !== "pending" ? pendingDeletion(member.accountId) : undefined), 10_000, 500);
    expect(state?.[1], "the request is no longer pending").toMatch(/cancel/);
    const me = await callApi("GET", "/api/v1/users/me", { token: member.accessToken });
    expect(me.status, describeResponse(me)).toBe(200);
    expect(me.body.username).toBe(member.username);
    const post = await callApi("GET", `/api/v1/posts/${postId}`, { token: member.accessToken });
    expect(post.status, "posts survive a cancelled deletion").toBe(200);
  });

  it("deletes the account once the grace period passes and then explains that sign-in no longer works", { timeout: 150_000 }, async () => {
    const requested = await callApi("POST", "/api/v1/users/me/deletion-request", { token: member.accessToken, body: { confirm: true, reason: "For real this time" } });
    expect([200, 201, 202], describeResponse(requested)).toContain(requested.status);
    const [requestId] = pendingDeletion(member.accountId) ?? [];
    psql(`update users.deletion_requests set scheduled_for = now() - interval '1 minute' where id = '${requestId}'`);
    const executed = await waitFor(async () => (pendingDeletion(member.accountId)?.[1] === "executed" ? true : undefined), 120_000, 3000);
    expect(executed, `deletion never ran: ${JSON.stringify(pendingDeletion(member.accountId))}`).toBe(true);
    expect(psql(`select status from auth.accounts where id = '${member.accountId}'`)[0]?.[0], "sessions are closed and the account is switched off").toMatch(/deactivated|deleted/);
    const refused = await callApi("POST", "/api/v1/auth/login", { body: { identifier: member.email, password: "Sm0ke-Test-Pass!2026" } });
    expectClearError(refused, [401, 403], ["ACCOUNT_DELETED", "INVALID_CREDENTIALS"]);
    expect(refused.body.code, "a deleted account is told so, not that the password is wrong").toBe("ACCOUNT_DELETED");
    const oldToken = await callApi("GET", "/api/v1/users/me", { token: member.accessToken });
    expect(oldToken.status, `an old token stops working: ${describeResponse(oldToken)}`).toBeGreaterThanOrEqual(400);
  });

  it("brings a deactivated account back when its owner signs in again", async () => {
    const resting = await registerUser("edgeresting");
    const deactivated = await callApi("POST", "/api/v1/users/me/deactivate", { token: resting.accessToken, body: {} });
    expect([200, 204], describeResponse(deactivated)).toContain(deactivated.status);
    const stale = await callApi("GET", "/api/v1/users/me", { token: resting.accessToken });
    expect(stale.status, "the old session is closed").toBeGreaterThanOrEqual(400);
    const back = await callApi("POST", "/api/v1/auth/login", { body: { identifier: resting.email, password: "Sm0ke-Test-Pass!2026" } });
    expect(back.status, describeResponse(back)).toBe(200);
    expect(back.body.notice).toMatch(/active again/);
    const me = await callApi("GET", "/api/v1/users/me", { token: back.body.accessToken });
    expect(me.status, describeResponse(me)).toBe(200);
    expect(psql(`select status from auth.accounts where id = '${resting.accountId}'`)[0]?.[0]).toBe("active");
  });
});
