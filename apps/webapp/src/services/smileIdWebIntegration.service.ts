import type { IdentityCaptureSession } from "@/types/identityVerification.type";

const smileIdScriptUrl = "https://cdn.usesmileid.com/inline/v12/js/script.min.js";

interface SmileIdentityOptions {
  readonly token: string;
  readonly product: string;
  readonly callback_url: string;
  readonly environment: "sandbox" | "production";
  readonly partner_params: { readonly nantty_case_id: string; readonly capture_attempt_id: string };
  readonly partner_details: { readonly partner_id: string; readonly name: string; readonly logo_url: string; readonly policy_url: string; readonly theme_color: string };
  readonly onResult: (result: SmileIdentityResult) => void;
}

type SmileIdentityResult =
  | { readonly status: "success"; readonly value?: unknown; readonly product?: string }
  | { readonly status: "cancelled"; readonly product?: string }
  | { readonly status: "failure"; readonly error: { readonly error_code: string; readonly message: string; readonly status: number; readonly retryable: boolean }; readonly product?: string };

function validateSmileIdentityResult(result: SmileIdentityResult, expectedProduct: string): SmileIdentityResult {
  if (!result || typeof result !== "object" || !["success", "failure", "cancelled"].includes(result.status)) {
    throw new Error("Smile ID returned an unreadable identity-check result. Refresh your verification status before trying again.");
  }
  if (result.status === "cancelled") {
    if (result.product !== undefined && result.product !== expectedProduct) {
      throw new Error("Smile ID returned a result for a different verification method. Refresh your verification status before trying again.");
    }
    return result;
  }
  if (result.product !== expectedProduct) {
    throw new Error("Smile ID returned a result for a different verification method. Refresh your verification status before trying again.");
  }
  if (result.status === "failure" && (!result.error || typeof result.error.error_code !== "string" || typeof result.error.retryable !== "boolean")) {
    throw new Error("Smile ID returned an unreadable identity-check error. Refresh your verification status before trying again.");
  }
  return result;
}

export function smileIdFailureMessage(result: Extract<SmileIdentityResult, { status: "failure" }>): string {
  switch (result.error.error_code) {
    case "CONSENT_DENIED":
      return "Smile ID did not receive your consent. You can continue only if you agree to the identity check terms.";
    case "CONFIG_INVALID":
      return "The identity check could not be configured. Please contact Nantty support.";
    case "SESSION_INIT_FAILED":
      return result.error.retryable
        ? "Smile ID could not confirm this check. Refresh your Nantty status; only start another session after Nantty confirms this attempt is closed."
        : "The identity check could not start. Please contact Nantty support if this continues.";
    case "SUBMISSION_FAILED":
      return result.error.retryable
        ? "Smile ID could not confirm this submission. Refresh your Nantty status; only start another session after Nantty confirms this attempt is closed."
        : "Smile ID could not confirm that your check was accepted. Refresh your verification status or contact Nantty support.";
    case "NOT_PERMITTED":
      return result.error.retryable
        ? "Smile ID could not run this check right now. Refresh your Nantty status; only retry after Nantty confirms this attempt is closed."
        : "This verification method is not available for this check. Refresh your status, then choose another supported ID or contact Nantty support.";
    case "DOCUMENTS_REJECTED":
      return result.error.retryable
        ? "Smile ID could not accept those document images. Refresh your Nantty status; only retry with new images after Nantty confirms this attempt is closed."
        : "Smile ID could not accept those document images. Refresh your status, then choose another supported ID or contact Nantty support.";
    default:
      return "The identity check could not be completed. Refresh your Nantty verification status before trying again or contact support.";
  }
}

function mapEnvironment(environment: string): "sandbox" | "production" {
  if (environment === "sandbox" || environment === "production") return environment;
  throw new Error("Identity verification is unavailable for this environment.");
}

declare global {
  interface Window {
    SmileIdentity?: (options: SmileIdentityOptions) => void;
  }
}

function loadSmileIdScript(): Promise<void> {
  if (window.SmileIdentity) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = smileIdScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The identity check could not load. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

export async function openSmileIdCapture(session: IdentityCaptureSession, policyUrl: string): Promise<"submitted" | "cancelled"> {
  await loadSmileIdScript();
  const smileIdentity = window.SmileIdentity;
  if (!smileIdentity) throw new Error("The identity check could not load. Refresh and try again.");
  return new Promise((resolve, reject) => {
    smileIdentity({
      token: session.token ?? "", product: session.product, callback_url: session.callbackUrl, environment: mapEnvironment(session.environment),
      partner_params: { nantty_case_id: session.caseId, capture_attempt_id: session.captureAttemptId },
      partner_details: {
        partner_id: session.partnerId, name: "Nantty", logo_url: new URL("/brand/icon512.png", window.location.origin).toString(),
        policy_url: policyUrl, theme_color: "#3B5BFD",
      },
      onResult: (result) => {
        try {
          const validated = validateSmileIdentityResult(result, session.product);
          if (validated.status === "success") resolve("submitted");
          else if (validated.status === "cancelled") resolve("cancelled");
          else reject(new Error(smileIdFailureMessage(validated)));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("The identity check could not be completed. Refresh your verification status before trying again."));
        }
      },
    });
  });
}

export async function runSmileIdCapture(
  session: IdentityCaptureSession,
  policyUrl: string,
  cancelAttempt: (caseId: string, captureAttemptId: string) => Promise<{ readonly cancelled: boolean }>,
): Promise<"submitted" | "cancelled"> {
  const result = await openSmileIdCapture(session, policyUrl);
  if (result === "cancelled") {
    const cancellation = await cancelAttempt(session.caseId, session.captureAttemptId);
    if (!cancellation.cancelled) throw new Error("Nantty could not confirm that this attempt was closed. Refresh your verification status before trying again.");
  }
  return result;
}
