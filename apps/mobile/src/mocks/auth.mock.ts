import { ApiError } from "@/errors/api.error";

import { demoFanAccount, getSignedInMockUser, me, mockSession } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const buildMockAuthSession = () => ({ accessToken: "mock-access", refreshToken: "mock-refresh", user: getSignedInMockUser() });

const DEMO_FAN_IDENTIFIER_HINTS = ["fan", "buyer"];

const signInDemoAccountMatchingIdentifier = (identifier: string) => {
  const lowered = identifier.toLowerCase();
  mockSession.signedInUserId = DEMO_FAN_IDENTIFIER_HINTS.some((hint) => lowered.includes(hint)) ? demoFanAccount.id : me.id;
};

const TOPICS = [
  "Entertainment", "Technology", "Entrepreneurship", "Nature", "STEM", "Artificial Intelligence", "News", "Politics",
  "Sports", "Computing", "Mathematics", "Health", "Blockchain", "Design", "Gadgets", "Culture", "Science", "Gossips",
  "Blue chips", "Relationships", "Mental Health", "Startups", "Life", "Parenting", "Climate & Environment",
  "International", "Travel", "Anime", "Education", "Faith & Spirituality", "Humor",
];

export const authMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/auth/login", ({ body }) => {
    const { identifier } = body as { identifier: string };
    if (!identifier.toLowerCase().includes("zudomart")) throw new ApiError(401, "Account doesn't exist", "ACCOUNT_NOT_FOUND");
    signInDemoAccountMatchingIdentifier(identifier);
    return buildMockAuthSession();
  }),
  createMockRoute("POST", "/api/v1/auth/register", () => {
    mockSession.signedInUserId = demoFanAccount.id;
    return buildMockAuthSession();
  }),
  createMockRoute("POST", "/api/v1/auth/otp/send", () => ({ expiresIn: 60 })),
  createMockRoute("POST", "/api/v1/auth/otp/verify", ({ body }) => {
    const { code } = body as { code: string };
    if (code.length !== 6) throw new ApiError(400, "Enter the 6-digit code");
    if (code === "000000") throw new ApiError(400, "That code is incorrect. Check it and try again.", "INVALID_CODE");
    return { otpToken: "mock-otp-token" };
  }),
  createMockRoute("GET", "/api/v1/auth/username-available", ({ query }) => ({ available: query.get("username") !== "taken" })),
  createMockRoute("POST", "/api/v1/auth/password/reset", () => undefined),
  createMockRoute("POST", "/api/v1/auth/logout", () => undefined),
  createMockRoute("POST", "/api/v1/auth/refresh", () => ({ accessToken: "mock-access", refreshToken: "mock-refresh" })),
  createMockRoute("GET", "/api/v1/topics", () => TOPICS.map((name, i) => ({ id: `t_${i}`, name }))),
  createMockRoute("PUT", "/api/v1/users/me/topics", () => undefined),
];
