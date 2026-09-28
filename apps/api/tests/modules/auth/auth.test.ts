import { afterAll, describe, expect, it } from "vitest";

import { createTestApplication } from "../../fixtures/testApplication.fixture.js";

const app = createTestApplication();
afterAll(() => app.close());

interface AuthBody {
  readonly user: { readonly id: string; readonly username: string; readonly emailVerified: boolean };
  readonly tokens: { readonly accessToken: string; readonly refreshToken: string };
}

describe("registration and login", () => {
  it("registers with email, hashes the password and signs in by email or username", async () => {
    const registered = await app.client
      .post("/api/v1/auth/register")
      .send({ email: "Ada@Example.com", username: "Ada_L", password: "Secret-pass-1", birthday: "1990-01-01" })
      .expect(201);
    const body = registered.json<AuthBody>();
    expect(body.user.username).toBe("ada_l");
    expect(JSON.stringify(body)).not.toContain("Secret-pass-1");
    expect(JSON.stringify(body)).not.toContain("scrypt");

    await app.client.post("/api/v1/auth/login").send({ identifier: "ada@example.com", password: "Secret-pass-1" }).expect(200);
    await app.client.post("/api/v1/auth/login").send({ identifier: "ada_l", password: "Secret-pass-1" }).expect(200);
    await app.client.get("/api/v1/users/me").auth(body.tokens.accessToken).expect(200).expectJson({ email: "ada@example.com" });
  });

  it("gives the same answer for an unknown account and a wrong password", async () => {
    const unknown = await app.client.post("/api/v1/auth/login").send({ identifier: "nobody@example.com", password: "Whatever-1" }).expect(401);
    const wrong = await app.client.post("/api/v1/auth/login").send({ identifier: "ada@example.com", password: "Wrong-pass-1" }).expect(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it("rejects weak passwords, under-age users and missing contact details", async () => {
    await app.client.post("/api/v1/auth/register").send({ email: "weak@example.com", username: "weakling", password: "short", birthday: "1990-01-01" }).expect(422);
    await app.client.post("/api/v1/auth/register").send({ email: "kid@example.com", username: "kiddo", password: "Secret-pass-1", birthday: "2020-01-01" }).expect(422);
    await app.client.post("/api/v1/auth/register").send({ username: "nocontact", password: "Secret-pass-1", birthday: "1990-01-01" }).expect(422);
  });

  it("reports whether a username is available", async () => {
    await app.client.get("/api/v1/auth/username-availability").query({ username: "ADA_L" }).expect(200).expectJson({ available: false });
    await app.client.get("/api/v1/auth/username-availability").query({ username: "someone_new" }).expect(200).expectJson({ available: true });
  });
});

describe("refresh token rotation", () => {
  it("rotates the refresh token and revokes the session when an old one is replayed", async () => {
    const user = await app.registerUser();
    const first = await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(200);
    const rotated = first.json<{ accessToken: string; refreshToken: string }>();
    expect(rotated.refreshToken).not.toBe(user.refreshToken);

    await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(401);
    await app.client.post("/api/v1/auth/refresh").send({ refreshToken: rotated.refreshToken }).expect(401);
    await app.client.get("/api/v1/users/me").auth(rotated.accessToken).expect(401);
  });

  it("expires access tokens after their lifetime", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(16 * 60);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    const refreshed = await app.client.post("/api/v1/auth/refresh").send({ refreshToken: user.refreshToken }).expect(200);
    await app.client.get("/api/v1/users/me").auth(refreshed.json<{ accessToken: string }>().accessToken).expect(200);
  });
});

describe("sessions", () => {
  it("logs out the current session and lets a user revoke only their own sessions", async () => {
    const user = await app.registerUser();
    const other = await app.registerUser();
    const sessions = await app.client.get("/api/v1/auth/sessions").auth(user.accessToken).expect(200);
    const items = sessions.json<{ items: { id: string; current: boolean }[] }>().items;
    expect(items.length).toBe(2);
    const current = items.find((session) => session.current);
    expect(current).toBeDefined();

    await app.client.delete(`/api/v1/auth/sessions/${current?.id ?? ""}`).auth(other.accessToken).expect(404);
    await app.client.post("/api/v1/auth/logout").auth(user.accessToken).expect(204);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
  });
});

describe("one-time codes", () => {
  it("verifies a contact with a single-use hashed code", async () => {
    const user = await app.registerUser();
    const code = app.oneTimeCodes.latestCodeFor(user.email, "verify_contact");
    expect(code).toMatch(/^\d{6}$/);
    const payload = { target: user.email, purpose: "verify_contact", code };
    await app.client.post("/api/v1/auth/otp/verify").auth(user.accessToken).send(payload).expect(200).expectJson({ verified: true });
    await app.client.post("/api/v1/auth/otp/verify").auth(user.accessToken).send(payload).expect(400);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(200).expectJson({ emailVerified: true });
  });

  it("locks a code after five wrong attempts", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(61);
    await app.client.post("/api/v1/auth/otp/send").send({ target: user.email, purpose: "login" }).expect(202);
    const code = app.oneTimeCodes.latestCodeFor(user.email, "login") ?? "";
    const wrongCode = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.client.post("/api/v1/auth/otp/verify").send({ target: user.email, purpose: "login", code: wrongCode }).expect(400);
    }
    await app.client.post("/api/v1/auth/otp/verify").send({ target: user.email, purpose: "login", code }).expect(400);
  });

  it("expires codes after five minutes and signs in with a valid login code", async () => {
    const user = await app.registerUser();
    app.clock.advanceBySeconds(61);
    await app.client.post("/api/v1/auth/otp/send").send({ target: user.email, purpose: "login" }).expect(202);
    const code = app.oneTimeCodes.latestCodeFor(user.email, "login");
    app.clock.advanceBySeconds(301);
    await app.client.post("/api/v1/auth/otp/verify").send({ target: user.email, purpose: "login", code }).expect(400);
    await app.client.post("/api/v1/auth/otp/send").send({ target: user.email, purpose: "login" }).expect(202);
    const fresh = app.oneTimeCodes.latestCodeFor(user.email, "login");
    await app.client.post("/api/v1/auth/otp/verify").send({ target: user.email, purpose: "login", code: fresh }).expect(200);
  });

  it("does not reveal whether an account exists when sending codes", async () => {
    await app.client.post("/api/v1/auth/otp/send").send({ target: "ghost@example.com", purpose: "login" }).expect(202);
    await app.client.post("/api/v1/auth/password/forgot").send({ target: "ghost@example.com" }).expect(202);
    expect(app.oneTimeCodes.latestCodeFor("ghost@example.com", "login")).toBeUndefined();
  });
});

describe("password reset", () => {
  it("resets the password with a code and signs out every session", async () => {
    const user = await app.registerUser();
    await app.client.post("/api/v1/auth/password/forgot").send({ target: user.email }).expect(202);
    const code = app.oneTimeCodes.latestCodeFor(user.email, "reset_password");
    await app.client.post("/api/v1/auth/password/reset").send({ target: user.email, code, newPassword: "Brand-new-pass-2" }).expect(204);
    await app.client.get("/api/v1/users/me").auth(user.accessToken).expect(401);
    await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: user.password }).expect(401);
    await app.client.post("/api/v1/auth/login").send({ identifier: user.email, password: "Brand-new-pass-2" }).expect(200);
  });
});

describe("social sign-in", () => {
  it("creates an account from a verified Google identity and reuses it next time", async () => {
    app.identityTokens.identities.set("google:token-1", {
      provider: "google", subject: "google-sub-1", email: "social@example.com", emailVerified: true, name: "Social Person",
    });
    const first = await app.client.post("/api/v1/auth/google").send({ idToken: "token-1-padded-to-length" }).expect(401);
    expect(first.status).toBe(401);
    app.identityTokens.identities.set("google:token-1-padded-to-length", {
      provider: "google", subject: "google-sub-1", email: "social@example.com", emailVerified: true, name: "Social Person",
    });
    const created = await app.client.post("/api/v1/auth/google").send({ idToken: "token-1-padded-to-length" }).expect(201);
    const again = await app.client.post("/api/v1/auth/google").send({ idToken: "token-1-padded-to-length" }).expect(200);
    expect(again.json<AuthBody>().user.id).toBe(created.json<AuthBody>().user.id);
  });
});
