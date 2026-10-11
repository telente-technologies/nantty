import { ApiError } from "@/errors/api.error";
import type { AuthSession, User } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";

const studioViewer: User = {
  id: "u_me",
  name: "Temitope Adeyemi",
  username: "temi.creates",
  avatarUrl: null,
  email: "creator@zudomart.com",
  isCreator: true,
  hasStore: true,
  storeId: "store_1",
  channelHandle: "@temi.creates",
};

let accessToken = "studio_access_token_demo";
let refreshToken = "studio_refresh_token_demo";

const mintSession = (): AuthSession => {
  accessToken = `studio_access_${Math.random().toString(36).slice(2)}`;
  refreshToken = `studio_refresh_${Math.random().toString(36).slice(2)}`;
  return { accessToken, refreshToken, user: studioViewer };
};

export const authMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/auth/login", ({ body }) => {
    const { identifier, password } = (body ?? {}) as { identifier?: string; password?: string };
    if (!identifier?.trim() || !password) throw new ApiError(401, "Enter your email or username and your password.", "INVALID_CREDENTIALS");
    return mintSession();
  }),
  createMockRoute("POST", "/api/v1/auth/google", ({ body }) => {
    if (!(body as { idToken?: string } | undefined)?.idToken) throw new ApiError(400, "Google sign-in failed. Try again.", "VALIDATION_FAILED");
    return mintSession();
  }),
  createMockRoute("POST", "/api/v1/auth/apple", ({ body }) => {
    if (!(body as { identityToken?: string } | undefined)?.identityToken) throw new ApiError(400, "Apple sign-in failed. Try again.", "VALIDATION_FAILED");
    return mintSession();
  }),
  createMockRoute("POST", "/api/v1/auth/logout", () => undefined),
  createMockRoute("POST", "/api/v1/auth/refresh", () => ({ accessToken, refreshToken })),
  createMockRoute("POST", "/api/v1/auth/step-up", ({ body }) => {
    if (!(body as { password?: string; otpToken?: string } | undefined)?.password && !(body as { otpToken?: string } | undefined)?.otpToken) throw new ApiError(400, "Enter your password or the code we emailed you.", "STEP_UP_PROOF_REQUIRED");
    return { stepUpToken: `studio_step_up_${Math.random().toString(36).slice(2)}`, expiresIn: 300, method: "password" };
  }),
  createMockRoute("POST", "/api/v1/auth/otp/send", ({ body }) => {
    if (!(body as { destination?: string } | undefined)?.destination) throw new ApiError(400, "destination is required", "VALIDATION_FAILED");
    return { expiresIn: 600 };
  }),
  createMockRoute("POST", "/api/v1/auth/otp/verify", ({ body }) => {
    if (!/^\d{6}$/.test((body as { code?: string } | undefined)?.code ?? "")) throw new ApiError(400, "That code isn't right. Check the email and try again.", "OTP_INVALID");
    return { otpToken: `otp_${Math.random().toString(36).slice(2)}` };
  }),
  createMockRoute("GET", "/api/v1/users/me", () => studioViewer),
];
