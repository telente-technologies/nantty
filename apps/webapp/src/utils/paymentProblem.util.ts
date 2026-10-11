import { requestConfirmation } from "@/components/ui/confirmDialog";
import { WebappRequestError } from "@/services/clientApi.service";

interface ProblemCopy {
  readonly title: string;
  readonly confirmLabel: string;
  readonly href?: string;
  readonly description?: string;
}

const payoutSetupHref = "/wallet/payouts";

const buyerProblems: Readonly<Record<string, ProblemCopy>> = {
  PAYMENT_AMOUNT_OUT_OF_RANGE: { title: "Amount not allowed", confirmLabel: "OK" },
  WALLET_DAILY_LIMIT: { title: "Wallet limit reached", confirmLabel: "OK" },
  SELLER_DEBT_LIMIT: {
    title: "This seller can't take new orders",
    confirmLabel: "OK",
    description: "One of the sellers in your cart can't take new orders right now. Remove their items to continue.",
  },
  VERIFICATION_REQUIRED: { title: "Verification needed", confirmLabel: "Verify now", href: payoutSetupHref },
  WALLET_NOT_READY: { title: "Your wallet isn't ready yet", confirmLabel: "Finish verification", href: payoutSetupHref },
  WALLET_ON_HOLD: { title: "Your wallet is on hold", confirmLabel: "Get help", href: "/help" },
  BVN_REQUIRED: { title: "Add your BVN", confirmLabel: "Open payout setup", href: payoutSetupHref },
  STEP_UP_REUSED: { title: "Confirm it's you again", confirmLabel: "OK" },
  CURSOR_EXPIRED: { title: "This list changed", confirmLabel: "Refresh" },
};

export const paymentProblemCodes = Object.keys(buyerProblems);

export function readPaymentProblemCode(error: unknown): string | null {
  return error instanceof WebappRequestError && error.code in buyerProblems ? error.code : null;
}

export function isSellerFacingVerificationError(error: unknown): boolean {
  return error instanceof WebappRequestError && error.code === "VERIFICATION_REQUIRED" && /seller/i.test(error.message);
}

export async function presentPaymentProblem(error: unknown, navigate: (href: string) => void): Promise<boolean> {
  const code = readPaymentProblemCode(error);
  if (!code || !(error instanceof WebappRequestError)) return false;
  const copy = buyerProblems[code]!;
  const sellerSide = isSellerFacingVerificationError(error);
  const href = sellerSide ? undefined : copy.href;
  const confirmed = await requestConfirmation({
    title: sellerSide ? "A seller isn't verified yet" : copy.title,
    description: copy.description ?? error.message,
    confirmLabel: href ? copy.confirmLabel : "OK",
    cancelLabel: href ? "Not now" : "Close",
    intent: code === "WALLET_DAILY_LIMIT" || code === "PAYMENT_AMOUNT_OUT_OF_RANGE" ? "warning" : "info",
  });
  if (confirmed && href) navigate(href);
  return true;
}
