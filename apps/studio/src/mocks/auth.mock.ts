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
  createMockRoute("POST", "/api/v1/auth/logout", () => undefined),
  createMockRoute("POST", "/api/v1/auth/refresh", () => ({ accessToken, refreshToken })),
  createMockRoute("GET", "/api/v1/users/me", () => studioViewer),
];
