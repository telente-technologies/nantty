import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { logInUser, readOneTimeCodeFromIdentityLog, registerUser, smokePassword } from "../src/actors.util.js";
import { callApi, describeResponse, uniqueSuffix } from "../src/apiClient.util.js";
import { psql } from "../src/commerceFixtures.util.js";
import { expectClearError } from "../src/journeyChecks.util.js";

async function sendSignupCode(email: string): Promise<void> {
  const sent = await callApi("POST", "/api/v1/auth/otp/send", { body: { destination: email, purpose: "signup" } });
  expect(sent.status, describeResponse(sent)).toBe(200);
}

function wrongCodeFor(code: string): string {
  return code === "000000" ? "111111" : "000000";
}

function signupBody(email: string, username: string, otpToken: string) {
  return { email, birthday: "1995-03-09", password: smokePassword, username, name: "Edge Signup", otpToken };
}

describe("sign up the way people really do it: taken names, wrong codes, closing the app midway", () => {
  const suffix = uniqueSuffix();
  const email = `edge${suffix}@smoke.nantty.test`;
  const wantedName = `edge${suffix}`.slice(0, 24);
  let otpToken = "";

  it("rejects a wrong code with a clear message and accepts the right one afterwards", async () => {
    await sendSignupCode(email);
    const code = await readOneTimeCodeFromIdentityLog(email, "signup");
    const wrong = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: email, code: wrongCodeFor(code), purpose: "signup" } });
    expectClearError(wrong, 400, "INVALID_CODE");
    const right = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: email, code, purpose: "signup" } });
    expect(right.status, describeResponse(right)).toBe(200);
    otpToken = right.body.otpToken;
    const reused = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: email, code, purpose: "signup" } });
    expectClearError(reused, 400, "INVALID_CODE");
  });

  it("locks the code after too many wrong guesses and lets a fresh code through", async () => {
    const lockedEmail = `edgelock${suffix}@smoke.nantty.test`;
    await sendSignupCode(lockedEmail);
    const code = await readOneTimeCodeFromIdentityLog(lockedEmail, "signup");
    let last = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: lockedEmail, code: wrongCodeFor(code), purpose: "signup" } });
    for (let attempt = 0; attempt < 6 && last.status === 400; attempt += 1) last = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: lockedEmail, code: wrongCodeFor(code), purpose: "signup" } });
    expectClearError(last, 429, "TOO_MANY_ATTEMPTS");
    const correctButLocked = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: lockedEmail, code, purpose: "signup" } });
    expectClearError(correctButLocked, [400, 429]);
    await sendSignupCode(lockedEmail);
    const fresh = await readOneTimeCodeFromIdentityLog(lockedEmail, "signup");
    const verified = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: lockedEmail, code: fresh, purpose: "signup" } });
    expect(verified.status, describeResponse(verified)).toBe(200);
  });

  it("offers suggestions for a taken username and keeps the verified email usable for the retry", async () => {
    const taken = await registerUser("edgetaken");
    const availability = await callApi("GET", `/api/v1/auth/username-available?username=${taken.username}`);
    expect(availability.status, describeResponse(availability)).toBe(200);
    expect(availability.body.available, describeResponse(availability)).toBe(false);
    const clash = await callApi("POST", "/api/v1/auth/register", { body: signupBody(email, taken.username, otpToken) });
    expectClearError(clash, 409, "USERNAME_TAKEN");
    expect(Array.isArray(clash.body.suggestions) && clash.body.suggestions.length > 0, describeResponse(clash)).toBe(true);
    expect(psql(`select count(*) from auth.accounts where email = '${email}'`)[0]?.[0], "a failed attempt must not create the account").toBe("0");
    const retried = await callApi("POST", "/api/v1/auth/register", { body: signupBody(email, wantedName, otpToken) });
    expect([200, 201], describeResponse(retried)).toContain(retried.status);
    expect(typeof retried.body.accessToken).toBe("string");
  });

  it("does not create a second account when Create account is tapped twice", async () => {
    const again = await callApi("POST", "/api/v1/auth/register", { body: signupBody(email, `${wantedName}x`, otpToken) });
    expectClearError(again, [400, 409], ["DESTINATION_NOT_VERIFIED", "EMAIL_TAKEN", "INVALID_CODE"]);
    expect(psql(`select count(*) from auth.accounts where lower(email) = lower('${email}')`)[0]?.[0]).toBe("1");
  });

  it("resumes a signup that was closed after the code step: a new code works and the old code is dead", async () => {
    const resumedEmail = `edgeresume${suffix}@smoke.nantty.test`;
    await sendSignupCode(resumedEmail);
    const firstCode = await readOneTimeCodeFromIdentityLog(resumedEmail, "signup");
    await sendSignupCode(resumedEmail);
    const secondCode = await readOneTimeCodeFromIdentityLog(resumedEmail, "signup");
    if (firstCode !== secondCode) {
      const stale = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: resumedEmail, code: firstCode, purpose: "signup" } });
      expectClearError(stale, 400, "INVALID_CODE");
    }
    const verified = await callApi("POST", "/api/v1/auth/otp/verify", { body: { destination: resumedEmail, code: secondCode, purpose: "signup" } });
    expect(verified.status, describeResponse(verified)).toBe(200);
    const withoutProof = await callApi("POST", "/api/v1/auth/register", { body: signupBody(resumedEmail, `res${suffix}`.slice(0, 24), randomBytes(32).toString("base64url")) });
    expectClearError(withoutProof, [400, 401], ["DESTINATION_NOT_VERIFIED", "INVALID_CODE"]);
    const otherEmail = await callApi("POST", "/api/v1/auth/register", { body: signupBody(`other${suffix}@smoke.nantty.test`, `oth${suffix}`.slice(0, 24), verified.body.otpToken) });
    expectClearError(otherEmail, [400, 401], ["DESTINATION_NOT_VERIFIED", "INVALID_CODE"]);
    const registered = await callApi("POST", "/api/v1/auth/register", { body: signupBody(resumedEmail, `res${suffix}`.slice(0, 24), verified.body.otpToken) });
    expect([200, 201], describeResponse(registered)).toContain(registered.status);
    const login = await logInUser(resumedEmail);
    expect(login.status).toBe(200);
  });
});
