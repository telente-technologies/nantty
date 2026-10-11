import { ApiError } from "@/errors/api.error";

import { api } from "../core/apiClient.service";

interface StepUpGrant {
  readonly stepUpToken: string;
  readonly expiresIn: number;
}

const reuseWindowMs = 4 * 60 * 1000;
let cachedGrant: { readonly token: string; readonly reusableUntil: number } | null = null;

function remember(grant: StepUpGrant): string {
  cachedGrant = { token: grant.stepUpToken, reusableUntil: Date.now() + Math.min(reuseWindowMs, grant.expiresIn * 1000 - 30_000) };
  return grant.stepUpToken;
}

export const readCachedStepUpToken = (): string | null => (cachedGrant && cachedGrant.reusableUntil > Date.now() ? cachedGrant.token : null);

export const forgetStepUpToken = (): void => {
  cachedGrant = null;
};

export const isStepUpRequiredError = (error: unknown): boolean => error instanceof ApiError && (error.code === "STEP_UP_REQUIRED" || error.code === "STEP_UP_REUSED");

export const stepUpService = {
  grantWithPassword: async (password: string) => remember(await api.post<StepUpGrant>("/api/v1/auth/step-up", { password })),
  sendEmailCode: (email: string) => api.post<{ readonly expiresIn: number }>("/api/v1/auth/otp/send", { destination: email, purpose: "login" }, { auth: false }),
  grantWithEmailCode: async (email: string, code: string) => {
    const verified = await api.post<{ readonly otpToken: string }>("/api/v1/auth/otp/verify", { destination: email, code, purpose: "login" }, { auth: false });
    return remember(await api.post<StepUpGrant>("/api/v1/auth/step-up", { otpToken: verified.otpToken }));
  },
};
