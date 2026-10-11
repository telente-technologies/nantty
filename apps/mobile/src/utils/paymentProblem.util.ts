import { ApiError } from "@/errors/api.error";
import type { ModalAction } from "@/components/ui/modalActions";
import type { ModalIntent } from "@/components/ui/modalIntent";
import { showDialog } from "@/store/dialog.store";

export interface PaymentProblemHandlers {
  readonly onVerify?: () => void;
  readonly onPayByCard?: () => void;
  readonly onConfirmAgain?: () => void;
  readonly onAddMoney?: () => void;
}

export interface PaymentProblemCopy {
  readonly title: string;
  readonly message: string;
  readonly intent: ModalIntent;
}

const fallbackMessages: Record<string, string> = {
  PAYMENT_AMOUNT_OUT_OF_RANGE: "This amount can't be paid in one payment.",
  WALLET_DAILY_LIMIT: "You've reached today's wallet limit. Pay by card, or try again tomorrow.",
  SELLER_DEBT_LIMIT: "You owe more than your selling limit allows. Clear what you owe to list items and take new orders again.",
  VERIFICATION_REQUIRED: "Verify your identity and add a payout account in your own name to continue. Nothing you've earned is lost while you verify.",
  STEP_UP_REUSED: "That confirmation was already used. Confirm it's you again for each money action.",
  WALLET_NOT_READY: "Finish payout verification to get your own wallet account number.",
  WALLET_ON_HOLD: "Your wallet is on hold while we check it. Contact support if this lasts.",
  BVN_REQUIRED: "Add your BVN in payout setup so we can confirm your bank account is in your name.",
};

const titles: Record<string, { readonly title: string; readonly intent: ModalIntent }> = {
  PAYMENT_AMOUNT_OUT_OF_RANGE: { title: "Amount not allowed", intent: "money" },
  WALLET_DAILY_LIMIT: { title: "Wallet limit reached", intent: "money" },
  SELLER_DEBT_LIMIT: { title: "Selling paused", intent: "warning" },
  VERIFICATION_REQUIRED: { title: "Verification needed", intent: "verify" },
  STEP_UP_REUSED: { title: "Confirm it's you again", intent: "stepUp" },
  WALLET_NOT_READY: { title: "Wallet not ready yet", intent: "verify" },
  WALLET_ON_HOLD: { title: "Wallet on hold", intent: "warning" },
  BVN_REQUIRED: { title: "BVN needed", intent: "verify" },
};

export const paymentProblemCodes = Object.keys(titles);

function isBuyerFacing(error: ApiError): boolean {
  return error.details?.["audience"] === "buyer";
}

export function describePaymentProblem(error: unknown): PaymentProblemCopy | null {
  if (!(error instanceof ApiError) || !error.code || !titles[error.code]) return null;
  if (error.code === "SELLER_DEBT_LIMIT" && isBuyerFacing(error)) return { title: "This seller can't take new orders", intent: "warning", message: error.message };
  const { title, intent } = titles[error.code]!;
  return { title, intent, message: error.message || fallbackMessages[error.code]! };
}

function actionsFor(code: string, handlers: PaymentProblemHandlers, buyerFacing: boolean): ModalAction[] {
  const actions: ModalAction[] = [];
  if ((code === "VERIFICATION_REQUIRED" || code === "WALLET_NOT_READY" || code === "BVN_REQUIRED") && handlers.onVerify) {
    actions.push({ label: "Verify now", style: "primary", onPress: handlers.onVerify });
  }
  if (code === "WALLET_DAILY_LIMIT" && handlers.onPayByCard) actions.push({ label: "Pay by card instead", style: "primary", onPress: handlers.onPayByCard });
  if (code === "SELLER_DEBT_LIMIT" && !buyerFacing && handlers.onAddMoney) actions.push({ label: "Add money", style: "primary", onPress: handlers.onAddMoney });
  if (code === "STEP_UP_REUSED" && handlers.onConfirmAgain) actions.push({ label: "Confirm again", style: "primary", onPress: handlers.onConfirmAgain });
  actions.push({ label: actions.length > 0 ? "Not now" : "OK", style: "secondary" });
  return actions;
}

export function presentPaymentProblem(error: unknown, handlers: PaymentProblemHandlers = {}): boolean {
  const copy = describePaymentProblem(error);
  if (!copy) return false;
  showDialog({ title: copy.title, message: copy.message, intent: copy.intent, actions: actionsFor((error as ApiError).code!, handlers, isBuyerFacing(error as ApiError)) });
  return true;
}
