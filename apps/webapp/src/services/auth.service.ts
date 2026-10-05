import type { Topic } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export interface RegisterInput {
  readonly email: string;
  readonly birthday: string;
  readonly password: string;
  readonly username?: string;
  readonly name?: string;
  readonly otpToken: string;
}

export const authService = {
  sendOneTimeCode: (destination: string, purpose: "signup" | "reset" | "login") =>
    sendRequestToWebappServer<{ expiresIn: number }>("/api/v1/auth/otp/send", { method: "POST", body: { destination, purpose } }),
  verifyOneTimeCode: (destination: string, code: string, purpose: "signup" | "reset" | "login") =>
    sendRequestToWebappServer<{ otpToken: string }>("/api/v1/auth/otp/verify", { method: "POST", body: { destination, code, purpose } }),
  checkUsernameAvailability: (username: string) =>
    sendRequestToWebappServer<{ available: boolean; reason?: string; suggestions?: readonly string[] }>("/api/v1/auth/username-available", { query: { username } }),
  suggestUsername: (seed: string) => sendRequestToWebappServer<{ username: string }>("/api/v1/auth/username-suggestion", { query: { seed } }),
  resetPasswordWithVerifiedCode: (otpToken: string, password: string) =>
    sendRequestToWebappServer<void>("/api/v1/auth/password/reset", { method: "POST", body: { otpToken, password } }),
  fetchPersonalizationTopics: () => sendRequestToWebappServer<Topic[]>("/api/v1/topics"),
  saveSelectedTopics: (topicIds: readonly string[]) =>
    sendRequestToWebappServer<void>("/api/v1/users/me/topics", { method: "PUT", body: { topicIds } }),
};
