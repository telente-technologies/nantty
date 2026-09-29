import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: { readonly id: string; readonly username: string; readonly emailVerified: boolean };
}

async function requestCode(destination: string, purpose: "signup" | "reset" | "login"): Promise<string> {
  await app.client.post("/api/v1/auth/otp/send").send({ destination, purpose }).expect(200).expectJson({ expiresIn: 300 });
  const code = app.oneTimeCodes.latestCodeFor(destination, purpose === "reset" ? "reset_password" : purpose);
  expect(code).toMatch(/^\d{6}$/);
  return code ?? "";
}

describe("sign up with a verified destination", () => {
  it("requires a signup otpToken for the same email and returns a session", async () => {
    await app.client.post("/api/v1/auth/register").send({ email: "ada@example.com", password: "Secret-pass-1", birthday: "1990-01-01", otpToken: "x".repeat(40) }).expect(400);
    const code = await requestCode("ada@example.com", "signup");
    const verified = await app.client.post("/api/v1/auth/otp/verify").send({ destination: "ada@example.com", code, purpose: "signup" }).expect(200);
    const otpToken = verified.json<{ otpToken: string }>().otpToken;
    await app.client
      .post("/api/v1/auth/register")
      .send({ email: "someone-else@example.com", password: "Secret-pass-1", birthday: "1990-01-01", otpToken })
      .expect(400);
    const registered = await app.client
      .post("/api/v1/auth/register")
      .send({ email: "Ada@Example.com", username: "Ada_L", password: "Secret-pass-1", birthday: "1990-01-01", otpToken })
      .expect(201);
    const session = registered.json<Session>();
    expect(session.user.username).toBe("ada_l");
    expect(session.user.emailVerified).toBe(true);
    expect(JSON.stringify(session)).not.toContain("Secret-pass-1");
    await app.client.get("/api/v1/users/me").auth(session.accessToken).expect(200).expectJson({ email: "ada@example.com" });
  });

  it("creates a username when none is given and rejects reused otpTokens", async () => {
    const code = await requestCode("nousername@example.com", "signup");
    const { otpToken } = (await app.client.post("/api/v1/auth/otp/verify").send({ destination: "nousername@example.com", code, purpose: "signup" }).expect(200)).json<{ otpToken: string }>();
    const body = { email: "nousername@example.com", password: "Secret-pass-1", birthday: "1990-01-01", otpToken };
    const session = (await app.client.post("/api/v1/auth/register").send(body).expect(201)).json<Session>();
    expect(session.user.username).toMatch(/^nousername[0-9a-f]{6}$/);
    await app.client.post("/api/v1/auth/register").send(body).expect(400);
  });

  it("rejects weak passwords and under-age users", async () => {
    await app.client.post("/api/v1/auth/register").send({ email: "weak@example.com", password: "short", birthday: "1990-01-01", otpToken: "y".repeat(40) }).expect(422);
    await app.client.post("/api/v1/auth/register").send({ email: "kid@example.com", password: "Secret-pass-1", birthday: "2020-01-01", otpToken: "y".repeat(40) }).expect(422);
  });

  it("does not send signup codes for existing accounts but answers the same way", async () => {
    await app.client.post("/api/v1/auth/otp/send").send({ destination: "ada@example.com", purpose: "signup" }).expect(200).expectJson({ expiresIn: 300 });
    await app.client.post("/api/v1/auth/otp/send").send({ destination: "ghost@example.com", purpose: "reset" }).expect(200).expectJson({ expiresIn: 300 });
    expect(app.oneTimeCodes.latestCodeFor("ghost@example.com", "reset_password")).toBeUndefined();
  });
});

describe("login", () => {
  it("signs in by email or username and gives one answer for unknown accounts and wrong passwords", async () => {
    await app.client.post("/api/v1/auth/login").send({ identifier: "ada_l", password: "Secret-pass-1" }).expect(200).expectJson({ user: { username: "ada_l" } });
    const unknown = await app.client.post("/api/v1/auth/login").send({ identifier: "nobody@example.com", password: "Whatever-1" }).expect(401);
    const wrong = await app.client.post("/api/v1/auth/login").send({ identifier: "ada@example.com", password: "Wrong-pass-1" }).expect(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it("reports whether a username is available", async () => {
    await app.client.get("/api/v1/auth/username-available").query({ username: "ADA_L" }).expect(200).expectJson({ available: false });
    await app.client.get("/api/v1/auth/username-available").query({ username: "someone_new" }).expect(200).expectJson({ available: true });
  });
});

describe("tokens and sessions", () => {
  it("rotates refresh tokens and revokes the session when an old one is replayed", async () => {
    const user = await app.registerUser();
    const rotated = (await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(200)).json<{ accessToken: string; refreshToken: string }>();
    expect(rotated.refreshToken).not.toBe(user.refreshToken);
    await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(401);
    await app.client.post("/api/v1/auth/refresh").send({ refreshToken: rotated.refreshToken }).expect(401);
    await app.client.get("/api/v1/users/me").auth(rotated.accessToken).expect(401);
  });

  it("expires access tokens after fifteen minutes", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(16 * 60);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    const refreshed = (await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(200)).json<{ accessToken: string }>();
    await app.client.get("/api/v1/users/me").auth(refreshed.accessToken).expect(200);
  });

  it("logs out with a refresh token and only revokes the caller's own sessions", async () => {
    const user = await app.registerUser();
    const other = await app.registerUser();
    const sessions = (await app.client.get("/api/v1/auth/sessions").auth(user.accessToken).expect(200)).json<{ id: string; current: boolean }[]>();
    const current = sessions.find((session) => session.current);
    await app.client.delete(`/api/v1/auth/sessions/${current?.id ?? ""}`).auth(other.accessToken).expect(404);
    await app.client.post("/api/v1/auth/logout").send({ refreshToken: user.refreshToken }).expect(204);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(401);
  });
});

describe("one-time codes", () => {
  it("locks a code after five wrong attempts", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(61);
    const code = await requestCode(user.email, "login");
    const wrongCode = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, purpose: "login", code: wrongCode }).expect(400);
    }
    await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, purpose: "login", code }).expect(400);
  });

  it("expires codes after five minutes and signs in with a valid login code", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(61);
    const expired = await requestCode(user.email, "login");
    app.clock.advanceBySeconds(301);
    await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, purpose: "login", code: expired }).expect(400);
    const fresh = await requestCode(user.email, "login");
    const result = await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, purpose: "login", code: fresh }).expect(200);
    expect(result.json<{ accessToken?: string; otpToken: string }>().accessToken).toBeTypeOf("string");
  });
});

describe("passwords", () => {
  it("resets the password with a reset otpToken and signs out every session", async () => {
    const user = await app.registerUser();
    const code = await requestCode(user.email, "reset");
    const { otpToken } = (await app.client.post("/api/v1/auth/otp/verify").send({ destination: user.email, code, purpose: "reset" }).expect(200)).json<{ otpToken: string }>();
    await app.client.post("/api/v1/auth/password/reset").send({ otpToken, password: "Brand-new-pass-2" }).expect(204);
    await app.client.post("/api/v1/auth/password/reset").send({ otpToken, password: "Another-pass-3" }).expect(400);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: "Brand-new-pass-2" }).expect(200);
  });

  it("changes the password only with the current password and keeps this session", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/auth/password/change").auth(user.accessToken).send({ currentPassword: "Wrong-pass-9", newPassword: "Changed-pass-4" }).expect(401);
    await app.client.post("/api/v1/auth/password/change").auth(user.accessToken).send({ currentPassword: user.password, newPassword: "Changed-pass-4" }).expect(204);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(200);
    await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: "Changed-pass-4" }).expect(200);
  });
});

describe("social sign-in", () => {
  it("creates an account from a verified Google identity and reuses it next time", async () => {
    app.identityTokens.identities.set("google:google-token-padded-to-length", {
      provider: "google", subject: "google-sub-1", email: "social@example.com", emailVerified: true, name: "Social Person",
    });
    await app.client.post("/api/v1/auth/google").send({ idToken: "unknown-token-padded-to-length" }).expect(401);
    const created = await app.client.post("/api/v1/auth/google").send({ idToken: "google-token-padded-to-length" }).expect(201);
    const again = await app.client.post("/api/v1/auth/google").send({ idToken: "google-token-padded-to-length" }).expect(200);
    expect(again.json<Session>().user.id).toBe(created.json<Session>().user.id);
  });
});
