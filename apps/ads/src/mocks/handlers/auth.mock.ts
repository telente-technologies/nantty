import { randomBytes, timingSafeEqual } from "node:crypto";

import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, requirePrincipal, respondWithError, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { demoAccountPassword } from "@/mocks/seed/demoPeople.mock";

const accessTokenLifetimeInSeconds = 15 * 60;
const failedAttemptsByIdentifier = new Map<string, { count: number; firstAttemptAt: number }>();

function issueMockTokenPair(userId: string) {
  const database = readMockDatabase();
  const accessToken = `mock_at_${randomBytes(24).toString("base64url")}`;
  const refreshToken = `mock_rt_${randomBytes(32).toString("base64url")}`;
  database.accessTokens.set(accessToken, { userId, expiresAtEpochMs: Date.now() + accessTokenLifetimeInSeconds * 1000 });
  database.refreshTokens.set(refreshToken, { userId, revoked: false });
  return { accessToken, refreshToken, expiresIn: accessTokenLifetimeInSeconds, tokenType: "Bearer" as const };
}

function isDemoPasswordCorrect(candidatePassword: string): boolean {
  const expected = Buffer.from(demoAccountPassword);
  const received = Buffer.from(candidatePassword);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function presentCurrentUser(userId: string) {
  const user = readMockDatabase().users.find((candidate) => candidate.id === userId);
  if (!user) throw new MockHttpError(404, "USER_NOT_FOUND", "Account not found.");
  return { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl };
}

export function registerAuthMockHandlers(): void {
  registerMockRoute(
    "POST",
    "/auth/login",
    (request) => {
      const body = readJsonObjectBody(request);
      const identifier = String(body.identifier ?? "").trim().toLowerCase();
      const attempts = failedAttemptsByIdentifier.get(identifier);
      if (attempts && attempts.count >= 5 && Date.now() - attempts.firstAttemptAt < 60_000) return respondWithError(429, "RATE_LIMITED", "Too many attempts.");
      const user = readMockDatabase().users.find((candidate) => candidate.email === identifier || candidate.username === identifier);
      if (!user || !isDemoPasswordCorrect(String(body.password ?? ""))) {
        const current = attempts && Date.now() - attempts.firstAttemptAt < 60_000 ? attempts : { count: 0, firstAttemptAt: Date.now() };
        failedAttemptsByIdentifier.set(identifier, { ...current, count: current.count + 1 });
        return respondWithError(401, "INVALID_CREDENTIALS", "That email, username or password is not right.");
      }
      failedAttemptsByIdentifier.delete(identifier);
      return respondWithJson(200, { ...issueMockTokenPair(user.id), user: presentCurrentUser(user.id) });
    },
    { public: true },
  );

  registerMockRoute(
    "POST",
    "/auth/refresh",
    (request) => {
      const database = readMockDatabase();
      const refreshToken = String(readJsonObjectBody(request).refreshToken ?? "");
      const record = database.refreshTokens.get(refreshToken);
      if (!record || record.revoked) return respondWithError(401, "INVALID_REFRESH_TOKEN", "Sign in again.");
      record.revoked = true;
      return respondWithJson(200, issueMockTokenPair(record.userId));
    },
    { public: true },
  );

  registerMockRoute("POST", "/auth/logout", (request) => {
    requirePrincipal(request);
    const record = readMockDatabase().refreshTokens.get(String(readJsonObjectBody(request).refreshToken ?? ""));
    if (record) record.revoked = true;
    return respondWithNoContent();
  });

  registerMockRoute("GET", "/users/me", (request) => respondWithJson(200, presentCurrentUser(requirePrincipal(request).userId)));
}
