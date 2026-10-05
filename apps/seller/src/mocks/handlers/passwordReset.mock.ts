import { randomBytes, timingSafeEqual } from "node:crypto";

import { readGlobalMockSlice, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { readJsonObjectBody, respondWithError, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

export const demoPasswordResetCode = "246810";

interface MockPasswordResetState {
  readonly codesByDestination: Map<string, { readonly userId: string; readonly expiresAtEpochMs: number; attempts: number }>;
  readonly otpTokens: Map<string, { readonly userId: string; readonly expiresAtEpochMs: number }>;
  readonly passwordOverridesByUserId: Map<string, string>;
}

function readPasswordResetState(): MockPasswordResetState {
  return readGlobalMockSlice<MockPasswordResetState>("passwordReset", () => ({ codesByDestination: new Map(), otpTokens: new Map(), passwordOverridesByUserId: new Map() }));
}

function findUserIdForDestination(destination: string): string | null {
  const normalised = destination.trim().toLowerCase();
  return readMockDatabase().users.find((user) => user.email === normalised)?.id ?? null;
}

export function doesPasswordMatchOverrideForUser(userId: string, candidatePassword: string): boolean | null {
  const override = readPasswordResetState().passwordOverridesByUserId.get(userId);
  if (override === undefined) return null;
  const expected = Buffer.from(override);
  const received = Buffer.from(candidatePassword);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function registerPasswordResetMockHandlers(): void {
  registerMockRoute("POST", "/auth/otp/send", (request) => {
    const body = readJsonObjectBody(request);
    const destination = String(body.destination ?? "").trim().toLowerCase();
    const userId = findUserIdForDestination(destination);
    if (userId && body.purpose === "reset") {
      readPasswordResetState().codesByDestination.set(destination, { userId, expiresAtEpochMs: Date.now() + 5 * 60_000, attempts: 0 });
    }
    return respondWithJson(200, { expiresIn: 300 });
  }, { public: true });

  registerMockRoute("POST", "/auth/otp/verify", (request) => {
    const body = readJsonObjectBody(request);
    const state = readPasswordResetState();
    const destination = String(body.destination ?? "").trim().toLowerCase();
    const pending = state.codesByDestination.get(destination);
    if (!pending || pending.expiresAtEpochMs < Date.now() || pending.attempts >= 5) return respondWithError(400, "OTP_INVALID", "That code is not right or has expired.");
    if (String(body.code ?? "") !== demoPasswordResetCode) {
      pending.attempts += 1;
      return respondWithError(400, "OTP_INVALID", "That code is not right or has expired.");
    }
    state.codesByDestination.delete(destination);
    const otpToken = `mock_otp_${randomBytes(24).toString("base64url")}`;
    state.otpTokens.set(otpToken, { userId: pending.userId, expiresAtEpochMs: Date.now() + 10 * 60_000 });
    return respondWithJson(200, { otpToken });
  }, { public: true });

  registerMockRoute("POST", "/auth/password/reset", (request) => {
    const body = readJsonObjectBody(request);
    const state = readPasswordResetState();
    const otpToken = String(body.otpToken ?? "");
    const record = state.otpTokens.get(otpToken);
    const password = typeof body.password === "string" ? body.password : "";
    if (!record || record.expiresAtEpochMs < Date.now()) return respondWithError(400, "OTP_TOKEN_INVALID", "Your reset session expired. Start again.");
    if (password.length < 8 || password.length > 128) return respondWithError(400, "VALIDATION_FAILED", "Use 8 to 128 characters.");
    state.otpTokens.delete(otpToken);
    state.passwordOverridesByUserId.set(record.userId, password);
    for (const session of readMockDatabase().apiSessions.values()) if (session.userId === record.userId) session.revoked = true;
    return respondWithNoContent();
  }, { public: true });
}
