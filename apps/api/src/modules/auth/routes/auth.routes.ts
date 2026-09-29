import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { AuthController } from "../controllers/auth.controller.js";
import {
  ChangePasswordBodySchema,
  LoginBodySchema,
  LogoutBodySchema,
  RefreshTokenBodySchema,
  RegisterBodySchema,
  ResetPasswordBodySchema,
  SendOneTimeCodeBodySchema,
  SessionParamsSchema,
  SocialSignInBodySchema,
  UsernameAvailabilityQuerySchema,
  VerifyOneTimeCodeBodySchema,
} from "../validators/auth.validator.js";

const BASE_PATH = "/api/v1/auth";
const TAG = "auth";

export function registerAuthRoutes(router: HttpRouter, controller: AuthController, web: WebKit): void {
  const { guard, limitSensitiveRequests } = web;
  const sensitive = guard.allowAnyone(limitSensitiveRequests);

  router.post(`${BASE_PATH}/register`, controller.register, { ...sensitive, ...describeRoute(TAG, "Create an account", { body: RegisterBodySchema }) });
  router.post(`${BASE_PATH}/login`, controller.login, { ...sensitive, ...describeRoute(TAG, "Sign in with a password", { body: LoginBodySchema }) });
  router.post(`${BASE_PATH}/google`, controller.signInWithGoogle, { ...sensitive, ...describeRoute(TAG, "Sign in with a Google ID token", { body: SocialSignInBodySchema }) });
  router.post(`${BASE_PATH}/apple`, controller.signInWithApple, { ...sensitive, ...describeRoute(TAG, "Sign in with an Apple ID token", { body: SocialSignInBodySchema }) });
  router.post(`${BASE_PATH}/otp/send`, controller.sendOneTimeCode, { ...sensitive, ...describeRoute(TAG, "Send a 6-digit code", { body: SendOneTimeCodeBodySchema }) });
  router.post(`${BASE_PATH}/otp/verify`, controller.verifyOneTimeCode, { ...sensitive, ...describeRoute(TAG, "Verify a 6-digit code", { body: VerifyOneTimeCodeBodySchema }) });
  router.post(`${BASE_PATH}/password/change`, controller.changePassword, { ...guard.requireSignedInUser(limitSensitiveRequests), ...describeRoute(TAG, "Change my password", { body: ChangePasswordBodySchema }) });
  router.post(`${BASE_PATH}/password/reset`, controller.resetPassword, { ...sensitive, ...describeRoute(TAG, "Reset a password with a verified otpToken", { body: ResetPasswordBodySchema }) });
  router.post(`${BASE_PATH}/refresh`, controller.refresh, { ...sensitive, ...describeRoute(TAG, "Rotate the refresh token", { body: RefreshTokenBodySchema }) });
  router.get(`${BASE_PATH}/username-available`, controller.checkUsernameAvailability, { ...guard.allowAnyone(), ...describeRoute(TAG, "Check whether a username is free", { query: UsernameAvailabilityQuerySchema }) });
  router.post(`${BASE_PATH}/logout`, controller.logout, { ...guard.allowAnyone(), ...describeRoute(TAG, "Sign out the session of a refresh token", { body: LogoutBodySchema }) });
  router.get(`${BASE_PATH}/sessions`, controller.listSessions, { ...guard.requirePermission("profile:manage"), ...describeRoute(TAG, "List active sessions") });
  router.get(`${BASE_PATH}/sessions/:id`, controller.getSession, { ...guard.requirePermission("profile:manage"), ...describeRoute(TAG, "Get a session", { params: SessionParamsSchema }) });
  router.delete(`${BASE_PATH}/sessions/:id`, controller.revokeSession, { ...guard.requirePermission("profile:manage"), ...describeRoute(TAG, "Sign out a session", { params: SessionParamsSchema }) });
}
