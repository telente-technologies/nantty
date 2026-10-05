import type { WaitlistSignupRequest, WaitlistSignupResult } from "@/types/waitlist.types";

import { postJsonToApi } from "./apiClient.util";
import { normalizeEmailAddress, validateEmailAddressFormat } from "./emailValidation.util";

const waitlistApiPath = "/api/v1/waitlist";
const allowedSourcePattern = /^[A-Za-z0-9_-]{1,40}$/;

function readMessageFromApiBody(responseBody: unknown): string | null {
  if (typeof responseBody !== "object" || responseBody === null) return null;
  const message = (responseBody as { message?: unknown }).message;
  return typeof message === "string" && message.length <= 200 ? message : null;
}

function describeFailedWaitlistStatus(status: number): string {
  if (status === 400 || status === 422) return "That email address was not accepted. Check it and try again.";
  if (status === 429) return "Too many attempts from this connection. Wait a minute, then try again.";
  return "We could not add you to the waitlist right now. Try again in a few minutes.";
}

export async function submitWaitlistEmailToApi(signupRequest: WaitlistSignupRequest): Promise<WaitlistSignupResult> {
  const validationError = validateEmailAddressFormat(signupRequest.email);
  if (validationError) return { outcome: "failed", message: validationError };

  const requestBody: WaitlistSignupRequest = {
    email: normalizeEmailAddress(signupRequest.email),
    ...(signupRequest.role ? { role: signupRequest.role } : {}),
    ...(signupRequest.source && allowedSourcePattern.test(signupRequest.source) ? { source: signupRequest.source } : {}),
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) return { outcome: "failed", message: "You're offline. Reconnect and try again." };

  try {
    const response = await postJsonToApi(waitlistApiPath, requestBody);
    if (response.status >= 200 && response.status < 300) {
      return { outcome: "joined", message: readMessageFromApiBody(response.body) ?? "You're on the list. We'll email you when Zudomart opens." };
    }
    if (response.status === 409) {
      return { outcome: "joined", message: "You're already on the list. We'll email you when Zudomart opens." };
    }
    return { outcome: "failed", message: describeFailedWaitlistStatus(response.status) };
  } catch {
    return { outcome: "failed", message: "We could not reach Zudomart. Check your connection and try again." };
  }
}
