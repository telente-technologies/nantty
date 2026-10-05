import { beforeAll, describe, expect, it } from "vitest";

import { registerUser, type UserActor } from "../src/actors.util.js";
import { callApi, describeResponse } from "../src/apiClient.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";

describe("contract fixes: theme preference and ads invites by email or username", () => {
  let owner: UserActor;
  let byEmail: UserActor;
  let byName: UserActor;

  beforeAll(async () => {
    [owner, byEmail, byName] = await Promise.all([registerUser("edgeadsowner"), registerUser("edgeadsmail"), registerUser("edgeadsname")]);
  });

  it("saves the theme on the profile and refuses unknown themes", async () => {
    const me = await callApi("GET", "/api/v1/users/me", { token: owner.accessToken });
    expect(me.body.theme, describeResponse(me)).toBe("system");
    const dark = await callApi("PATCH", "/api/v1/users/me/preferences", { token: owner.accessToken, body: { theme: "dark" } });
    expect([200, 204], describeResponse(dark)).toContain(dark.status);
    expect((await callApi("GET", "/api/v1/users/me", { token: owner.accessToken })).body.theme).toBe("dark");
    expectClearError(await callApi("PATCH", "/api/v1/users/me/preferences", { token: owner.accessToken, body: { theme: "purple" } }), [400, 422]);
    expectClearError(await callApi("PATCH", "/api/v1/users/me/preferences", { token: owner.accessToken, body: {} }), [400, 422]);
    const both = await callApi("PATCH", "/api/v1/users/me/preferences", { token: owner.accessToken, body: { theme: "light", countryCode: "NG" } });
    expect([200, 204], describeResponse(both)).toContain(both.status);
    const after = await callApi("GET", "/api/v1/users/me", { token: owner.accessToken });
    expect([after.body.theme, after.body.countryCode]).toEqual(["light", "NG"]);
  });

  it("invites ad account members by email or username and explains misses", async () => {
    const account = await callApi("POST", "/api/v1/ads/accounts", { token: owner.accessToken, body: { name: "Edge Ads", kind: "personal", storeId: null, countryCode: "NG", timezone: "Africa/Lagos" } });
    expect(account.status, describeResponse(account)).toBe(201);
    const invites = `/api/v1/ads/accounts/${account.body.id}/invites`;
    const mail = await callApi("POST", invites, { token: owner.accessToken, body: { email: byEmail.email.toUpperCase(), role: "analyst" } });
    expect(mail.status, describeResponse(mail)).toBe(201);
    expect(mail.body.username).toBe(byEmail.username);
    expect(JSON.stringify(mail.body), "the invite never echoes the invitee's email").not.toContain(byEmail.email);
    const name = await callApi("POST", invites, { token: owner.accessToken, body: { username: `@${byName.username}`, role: "advertiser" } });
    expect(name.status, describeResponse(name)).toBe(201);
    const nobody = await callApi("POST", invites, { token: owner.accessToken, body: { email: `nobody.${Date.now()}@smoke.zudomart.test`, role: "analyst" } });
    expectClearError(nobody, 400, "VALIDATION_FAILED");
    expect(JSON.stringify(nobody.body)).toMatch(/sign up first/);
    const duplicate = await callApi("POST", invites, { token: owner.accessToken, body: { username: byEmail.username, role: "analyst" } });
    expectClearError(duplicate, 400, "VALIDATION_FAILED");
    expect(JSON.stringify(duplicate.body)).toMatch(/pending invite/);
  });
});
