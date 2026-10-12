import type { NextAction } from "@/components/ui/studioPage";
import { webappLinks } from "@/config/webappLinks.config";
import type { LiveSession } from "@/types";
import type { AccountHealthSummary } from "@/types/accountHealth.type";
import type { SubscriptionPlan } from "@/types/audience.type";
import type { CreatorStatus } from "@/types/creator.type";
import type { PayoutOnboardingState } from "@/types/payoutOnboarding.type";
import type { ZudomartWalletSummary } from "@/types/zudomartWallet.type";

import { formatMoneyForDisplay } from "./formatMoney.util";

export interface CreatorSignals {
  readonly health?: AccountHealthSummary;
  readonly status?: CreatorStatus;
  readonly wallet?: ZudomartWalletSummary;
  readonly payout?: PayoutOnboardingState;
  readonly plans?: readonly SubscriptionPlan[];
  readonly lives?: readonly LiveSession[];
}

const formatDeadline = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function healthActions(health: AccountHealthSummary | undefined): NextAction[] {
  if (!health) return [];
  const actions: NextAction[] = health.notices
    .filter((notice) => notice.deadlineAt)
    .map((notice) => ({
      key: `notice-${notice.claimId}`, tone: "urgent", external: true, href: webappLinks.accountStatus, label: "Respond",
      title: `Copyright notice${notice.workTitle ? ` for "${notice.workTitle}"` : ""}`,
      detail: `Remove the content or send a counter-notice by ${formatDeadline(notice.deadlineAt!)}, or you get a strike.`,
    }));
  const paused = [!health.canMonetise ? "earning" : null, !health.canGoLive ? "going live" : null].filter(Boolean);
  if (paused.length > 0) {
    actions.push({ key: "restricted", tone: "urgent", href: "/settings/account", label: "See strikes", title: `${paused.join(" and ")} is paused`, detail: `You have ${health.activeStrikeCount} active strikes. It lifts when strikes expire or an appeal succeeds.` });
  }
  return actions;
}

function moneyActions(wallet: ZudomartWalletSummary | undefined, payout: PayoutOnboardingState | undefined): NextAction[] {
  if (payout?.status === "action_needed") return [{ key: "payout-fix", tone: "urgent", href: "/earnings#payout-setup", label: "Fix payout details", title: "Payout verification needs a fix", detail: payout.reasons[0]?.message ?? "Some payout details were rejected." }];
  const verificationMessage = wallet?.verification?.message;
  if (verificationMessage && !wallet?.verification?.withdrawalsUnlocked) {
    return [{ key: "payout-verify", href: "/earnings#payout-setup", label: "Set up payouts", title: verificationMessage, detail: "Your earnings are kept. You need verified payout details before you can withdraw." }];
  }
  const available = wallet?.available;
  if (available && available.amountMinor > 0 && wallet?.verification?.withdrawalsUnlocked !== false) {
    return [{ key: "withdraw", external: true, href: webappLinks.withdraw, label: "Withdraw", title: `${formatMoneyForDisplay(available)} is ready to withdraw`, detail: "Withdrawals go to the bank account on your payout details." }];
  }
  return [];
}

export function buildCreatorNextActions(signals: CreatorSignals): NextAction[] {
  const actions: NextAction[] = [];
  const liveNow = signals.lives?.find((live) => live.state === "live" || live.state === "connecting");
  if (liveNow) actions.push({ key: "live-now", tone: "urgent", href: `/lives/${liveNow.id}`, label: "Open control room", title: `You're live: ${liveNow.title}`, detail: "Watch chat, gifts and guests from the control room." });
  if (signals.status?.suspensionReason) actions.push({ key: "suspended", tone: "urgent", href: "/settings/account", label: "See why", title: "Your Creator Program membership is suspended", detail: signals.status.suspensionReason });
  actions.push(...healthActions(signals.health), ...moneyActions(signals.wallet, signals.payout));
  if (signals.plans && !signals.plans.some((plan) => plan.active)) {
    actions.push({ key: "plan", href: "/subscribers", label: "Create a tier", title: "Offer a monthly subscription", detail: "Fans pay monthly for perks you choose. You set the price; app-store fees are shown before you publish." });
  }
  if (signals.lives && signals.lives.length === 0) {
    actions.push({ key: "first-live", href: "/lives", label: "Create a live", title: "Go live for the first time", detail: "Gifts during lives are the fastest way to start earning." });
  }
  return actions;
}
