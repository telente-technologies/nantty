import { sendRequestToWebappServer, WebappRequestError } from "./clientApi.service";

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

export function readCachedStepUpToken(): string | null {
  return cachedGrant && cachedGrant.reusableUntil > Date.now() ? cachedGrant.token : null;
}

export function forgetStepUpToken(): void {
  cachedGrant = null;
}

export function isStepUpRequiredError(error: unknown): boolean {
  return error instanceof WebappRequestError && (error.code === "STEP_UP_REQUIRED" || error.code === "STEP_UP_REUSED");
}

export const stepUpService = {
  grantWithPassword: async (password: string) =>
    remember(await sendRequestToWebappServer<StepUpGrant>("/api/v1/auth/step-up", { method: "POST", body: { password } })),
  sendEmailCode: (email: string) =>
    sendRequestToWebappServer<{ readonly expiresIn: number }>("/api/v1/auth/otp/send", { method: "POST", body: { destination: email, purpose: "login" } }),
  grantWithEmailCode: async (email: string, code: string) => {
    const verified = await sendRequestToWebappServer<{ readonly otpToken: string }>("/api/v1/auth/otp/verify", { method: "POST", body: { destination: email, code, purpose: "login" } });
    return remember(await sendRequestToWebappServer<StepUpGrant>("/api/v1/auth/step-up", { method: "POST", body: { otpToken: verified.otpToken } }));
  },
};
