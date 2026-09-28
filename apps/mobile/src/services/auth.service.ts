import type { AuthSession, Topic } from "@/types";

import { api } from "./api-client.service";

export interface RegisterInput {
  readonly email?: string;
  readonly phone?: string;
  readonly birthday: string;
  readonly password: string;
  readonly username?: string;
  readonly otpToken: string;
}

export const authService = {
  logInWithEmailOrUsername: (identifier: string, password: string) => api.post<AuthSession>("/api/v1/auth/login", { identifier, password }, { auth: false }),
  registerNewAccount: (input: RegisterInput) => api.post<AuthSession>("/api/v1/auth/register", input, { auth: false }),
  sendOneTimeCode: (destination: string, purpose: "signup" | "reset" | "login") =>
    api.post<{ expiresIn: number }>("/api/v1/auth/otp/send", { destination, purpose }, { auth: false }),
  verifyOneTimeCode: (destination: string, code: string, purpose: "signup" | "reset" | "login") =>
    api.post<{ otpToken: string }>("/api/v1/auth/otp/verify", { destination, code, purpose }, { auth: false }),
  checkIfUsernameIsAvailable: (username: string) => api.get<{ available: boolean }>("/api/v1/auth/username-available", { username }),
  resetPasswordWithVerifiedCode: (otpToken: string, password: string) =>
    api.post<void>("/api/v1/auth/password/reset", { otpToken, password }, { auth: false }),
  logOutCurrentSession: (refreshToken: string | null) => api.post<void>("/api/v1/auth/logout", { refreshToken }),
  fetchPersonalizationTopics: () => api.get<Topic[]>("/api/v1/topics"),
  saveSelectedTopics: (topicIds: readonly string[]) => api.put<void>("/api/v1/users/me/topics", { topicIds }),
  signInWithSocialProvider: async (provider: "apple" | "google"): Promise<AuthSession> => {
    throw new Error(`${provider === "apple" ? "Apple" : "Google"} sign-in isn't configured yet.`);
  },
};
