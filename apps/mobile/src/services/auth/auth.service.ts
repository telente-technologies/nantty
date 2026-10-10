import type { AuthSession, Topic } from "@/types";

import { SocialSignInNotConfiguredError, type SocialSignInProvider } from "@/errors/socialSignIn.error";

import { ApiError, api } from "../core/apiClient.service";
import { requestAppleIdentityTokenWithNonce, type AppleFullName } from "./appleSignIn.service";
import { requestGoogleIdTokenWithNonce } from "./googleSignIn.service";

export interface RegisterInput {
  readonly email: string;
  readonly birthday: string;
  readonly password: string;
  readonly username?: string;
  readonly otpToken: string;
}

const rethrowSocialSignInNotConfigured = (provider: SocialSignInProvider) => (error: unknown): never => {
  if (error instanceof ApiError && error.code === "SOCIAL_SIGN_IN_NOT_CONFIGURED") throw new SocialSignInNotConfiguredError(provider);
  throw error;
};

export const authService = {
  logInWithEmailOrUsername: (identifier: string, password: string) => api.post<AuthSession>("/api/v1/auth/login", { identifier, password }, { auth: false }),
  registerNewAccount: (input: RegisterInput) => api.post<AuthSession>("/api/v1/auth/register", input, { auth: false }),
  sendOneTimeCode: (destination: string, purpose: "signup" | "reset" | "login") =>
    api.post<{ expiresIn: number }>("/api/v1/auth/otp/send", { destination, purpose }, { auth: false }),
  verifyOneTimeCode: (destination: string, code: string, purpose: "signup" | "reset" | "login") =>
    api.post<{ otpToken: string }>("/api/v1/auth/otp/verify", { destination, code, purpose }, { auth: false }),
  checkIfUsernameIsAvailable: (username: string) => api.get<{ available: boolean; message?: string; suggestions?: readonly string[] }>("/api/v1/auth/username-available", { username }),
  resetPasswordWithVerifiedCode: (otpToken: string, password: string) =>
    api.post<void>("/api/v1/auth/password/reset", { otpToken, password }, { auth: false }),
  logOutCurrentSession: (refreshToken: string | null) => api.post<void>("/api/v1/auth/logout", { refreshToken }),
  fetchPersonalizationTopics: () => api.getList<Topic>("/api/v1/topics"),
  saveSelectedTopics: (topicIds: readonly string[]) => api.put<void>("/api/v1/users/me/topics", { topicIds }),
  exchangeGoogleIdTokenForSession: (idToken: string, nonce: string) =>
    api.post<AuthSession>("/api/v1/auth/google", { idToken, nonce }, { auth: false }).catch(rethrowSocialSignInNotConfigured("google")),
  exchangeAppleIdentityTokenForSession: (identityToken: string, nonce: string, fullName: AppleFullName | null) =>
    api
      .post<AuthSession>("/api/v1/auth/apple", { identityToken, nonce, ...(fullName ? { fullName } : {}) }, { auth: false })
      .catch(rethrowSocialSignInNotConfigured("apple")),
  signInWithSocialProvider: async (provider: SocialSignInProvider): Promise<AuthSession> => {
    if (provider === "google") {
      const { idToken, nonce } = await requestGoogleIdTokenWithNonce();
      return authService.exchangeGoogleIdTokenForSession(idToken, nonce);
    }
    const { identityToken, nonce, fullName } = await requestAppleIdentityTokenWithNonce();
    return authService.exchangeAppleIdentityTokenForSession(identityToken, nonce, fullName);
  },
};
