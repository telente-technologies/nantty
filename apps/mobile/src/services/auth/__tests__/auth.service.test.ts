jest.mock("../../core/apiClient.service", () => ({
  ApiError: jest.requireActual("@/errors/api.error").ApiError,
  api: { post: jest.fn() },
}));
jest.mock("../googleSignIn.service", () => ({ requestGoogleIdTokenWithNonce: jest.fn() }));
jest.mock("../appleSignIn.service", () => ({ requestAppleIdentityTokenWithNonce: jest.fn() }));

import { ApiError } from "@/errors/api.error";
import { api } from "../../core/apiClient.service";
import { requestAppleIdentityTokenWithNonce } from "../appleSignIn.service";
import { authService } from "../auth.service";
import { requestGoogleIdTokenWithNonce } from "../googleSignIn.service";
import type { AuthSession } from "@/types";

const session = { accessToken: "access", refreshToken: "refresh", user: { id: "account" } } as AuthSession;
const missingBirthday = () => new ApiError(422, "Add your birthday to continue.", "BIRTHDAY_REQUIRED");

describe("social sign-in birthday challenge", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reuses the Google token and nonce after collecting birthday", async () => {
    jest.mocked(requestGoogleIdTokenWithNonce).mockResolvedValue({ idToken: "google-token", nonce: "google-nonce" });
    jest.mocked(api.post).mockRejectedValueOnce(missingBirthday()).mockResolvedValueOnce(session);

    const attempt = await authService.beginSocialSignIn("google");
    expect(attempt.status).toBe("birthday_required");
    if (attempt.status !== "birthday_required") throw new Error("Expected a birthday challenge.");
    expect(attempt.challenge).toEqual({ provider: "google", idToken: "google-token", nonce: "google-nonce" });
    await expect(authService.completeSocialSignInWithBirthday(attempt.challenge, "1990-05-05")).resolves.toBe(session);

    expect(api.post).toHaveBeenNthCalledWith(1, "/api/v1/auth/google", { idToken: "google-token", nonce: "google-nonce" }, { auth: false });
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/v1/auth/google", { idToken: "google-token", nonce: "google-nonce", birthday: "1990-05-05" }, { auth: false });
  });

  it("preserves the Apple full name and nonce across the birthday retry", async () => {
    const fullName = { givenName: "Ada", familyName: "Lovelace" };
    jest.mocked(requestAppleIdentityTokenWithNonce).mockResolvedValue({ identityToken: "apple-token", nonce: "apple-nonce", fullName });
    jest.mocked(api.post).mockRejectedValueOnce(missingBirthday()).mockResolvedValueOnce(session);

    const attempt = await authService.beginSocialSignIn("apple");
    expect(attempt.status).toBe("birthday_required");
    if (attempt.status !== "birthday_required") throw new Error("Expected a birthday challenge.");
    await expect(authService.completeSocialSignInWithBirthday(attempt.challenge, "1990-05-05")).resolves.toBe(session);

    expect(api.post).toHaveBeenNthCalledWith(2, "/api/v1/auth/apple", {
      identityToken: "apple-token",
      nonce: "apple-nonce",
      fullName,
      birthday: "1990-05-05",
    }, { auth: false });
  });

  it("does not convert unrelated provider failures into a birthday prompt", async () => {
    const failure = new ApiError(503, "Provider unavailable.", "UPSTREAM_UNAVAILABLE");
    jest.mocked(requestGoogleIdTokenWithNonce).mockResolvedValue({ idToken: "google-token", nonce: "google-nonce" });
    jest.mocked(api.post).mockRejectedValue(failure);

    await expect(authService.beginSocialSignIn("google")).rejects.toBe(failure);
  });
});
