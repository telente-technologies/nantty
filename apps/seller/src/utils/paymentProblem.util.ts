import { requestConfirmation } from "@nantty/web-kit";

const problemTitles: Readonly<Record<string, string>> = {
  PAYMENT_AMOUNT_OUT_OF_RANGE: "Amount not allowed",
  WALLET_DAILY_LIMIT: "Wallet limit reached",
  SELLER_DEBT_LIMIT: "Selling paused",
  VERIFICATION_REQUIRED: "Verification needed",
  WALLET_DEBT_OUTSTANDING: "Clear what you owe first",
  WALLET_NOT_READY: "Wallet not ready",
  WALLET_ON_HOLD: "Wallet on hold",
};

function readProblem(error: unknown): { readonly code: string; readonly message: string } | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === "string" && code in problemTitles ? { code, message: typeof message === "string" ? message : "" } : null;
}

export function isPaymentProblem(error: unknown): boolean {
  return readProblem(error) !== null;
}

export async function presentPaymentProblem(error: unknown, options: { readonly onVerify?: () => void } = {}): Promise<boolean> {
  const problem = readProblem(error);
  if (!problem) return false;
  const needsVerification = problem.code === "VERIFICATION_REQUIRED" || problem.code === "WALLET_NOT_READY";
  const confirmed = await requestConfirmation({
    title: problemTitles[problem.code] ?? "Payment problem",
    description: problem.message,
    confirmLabel: needsVerification ? "Verify now" : "OK",
    cancelLabel: needsVerification ? "Not now" : undefined,
    intent: needsVerification ? "verify" : "warning",
  });
  if (confirmed && needsVerification) {
    if (options.onVerify) options.onVerify();
    else window.location.assign("/settings/payouts");
  }
  return true;
}
