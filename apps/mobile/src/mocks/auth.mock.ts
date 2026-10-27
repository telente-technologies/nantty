import { ApiError } from "@/errors/api.error";

import { demoFanAccount, getSignedInMockUser, me, mockSession, suspendedDemoAccount } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { buildUsernameUnavailableError, checkAvailability, generateAutomaticUsername } from "./username.mock";
import { applyProfileEditForSignedInUser, signedInProfile } from "./users.mock";

const buildMockAuthSession = () => ({ accessToken: "mock-access", refreshToken: "mock-refresh", user: getSignedInMockUser() });

const DEMO_FAN_IDENTIFIER_HINTS = ["fan", "buyer"];

const signInDemoAccountMatchingIdentifier = (identifier: string) => {
  const lowered = identifier.toLowerCase();
  mockSession.signedInUserId = lowered.includes("suspended")
    ? suspendedDemoAccount.id
    : DEMO_FAN_IDENTIFIER_HINTS.some((hint) => lowered.includes(hint)) ? demoFanAccount.id : me.id;
};

const TOPICS = [
  "Entertainment", "Technology", "Entrepreneurship", "Nature", "STEM", "Artificial Intelligence", "News", "Politics",
  "Sports", "Computing", "Mathematics", "Health", "Blockchain", "Design", "Gadgets", "Culture", "Science", "Gossips",
  "Blue chips", "Relationships", "Mental Health", "Startups", "Life", "Parenting", "Climate & Environment",
  "International", "Travel", "Anime", "Education", "Faith & Spirituality", "Humor",
];

const MINIMUM_IDENTITY_TOKEN_LENGTH = 20;

const requireIdentityTokenInBody = (token: unknown, fieldName: string) => {
  if (typeof token !== "string" || token.split(".").length !== 3 || token.length < MINIMUM_IDENTITY_TOKEN_LENGTH) {
    throw new ApiError(400, `${fieldName} must be a signed identity token`, "INVALID_IDENTITY_TOKEN");
  }
};

export const authMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/auth/google", ({ body }) => {
    requireIdentityTokenInBody((body as { idToken?: unknown }).idToken, "idToken");
    mockSession.signedInUserId = me.id;
    return buildMockAuthSession();
  }),
  createMockRoute("POST", "/api/v1/auth/apple", ({ body }) => {
    const { identityToken, fullName } = body as { identityToken?: unknown; fullName?: { givenName?: string | null; familyName?: string | null } };
    requireIdentityTokenInBody(identityToken, "identityToken");
    mockSession.signedInUserId = demoFanAccount.id;
    const displayName = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(" ");
    if (displayName) applyProfileEditForSignedInUser({ name: displayName });
    return { ...buildMockAuthSession(), user: signedInProfile() };
  }),
  createMockRoute("POST", "/api/v1/auth/login", ({ body }) => {
    const { identifier } = body as { identifier: string };
    if (!identifier.toLowerCase().includes("nantty")) throw new ApiError(401, "Account doesn't exist", "ACCOUNT_NOT_FOUND");
    signInDemoAccountMatchingIdentifier(identifier);
    return buildMockAuthSession();
  }),
  createMockRoute("POST", "/api/v1/auth/step-up", ({ body }) => {
    const proof = (body ?? {}) as { password?: string; otpToken?: string };
    if (!proof.password && !proof.otpToken) throw new ApiError(400, "Enter your password or the code we emailed you.", "STEP_UP_PROOF_REQUIRED");
    return { stepUpToken: `mock-step-up-${Date.now()}`, expiresIn: 300, method: proof.password ? "password" : "emailCode" };
  }),
  createMockRoute("POST", "/api/v1/auth/register", ({ body }) => {
    const { username, email } = body as { username?: string; email?: string };
    const availability = username?.trim() ? checkAvailability(username) : null;
    if (availability && !availability.available) throw buildUsernameUnavailableError(availability);
    mockSession.signedInUserId = demoFanAccount.id;
    applyProfileEditForSignedInUser({ username: username?.trim() || generateAutomaticUsername(email ?? "nantty") });
    return { ...buildMockAuthSession(), user: signedInProfile() };
  }),
  createMockRoute("POST", "/api/v1/auth/otp/send", () => ({ expiresIn: 60 })),
  createMockRoute("POST", "/api/v1/auth/otp/verify", ({ body }) => {
    const { code } = body as { code: string };
    if (code.length !== 6) throw new ApiError(400, "Enter the 6-digit code");
    if (code === "000000") throw new ApiError(400, "That code is incorrect. Check it and try again.", "INVALID_CODE");
    return { otpToken: "mock-otp-token" };
  }),
  createMockRoute("POST", "/api/v1/auth/password/reset", () => undefined),
  createMockRoute("POST", "/api/v1/auth/logout", () => undefined),
  createMockRoute("POST", "/api/v1/auth/refresh", () => ({ accessToken: "mock-access", refreshToken: "mock-refresh" })),
  createMockRoute("GET", "/api/v1/topics", () => TOPICS.map((name, i) => ({ id: `t_${i}`, name }))),
  createMockRoute("PUT", "/api/v1/users/me/topics", () => undefined),
];
