import Link from "next/link";

import { Badge } from "@/components/ui/feedback";
import { CheckIcon, AlertIcon, ShieldIcon } from "@/components/ui/icons";
import type { DisputeStatusEvent, EscrowDetail } from "@/types/commerce.type";
import {
  buildEscrowTimelineSteps, describeEscrowRelease, DISPUTE_STATUS_APPEARANCE, ESCROW_STAGE_APPEARANCE, formatFriendlyDateTime, type EscrowViewerRole,
} from "@/utils/escrowStage.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import styles from "./escrow.module.css";

const BUYER_POINTS = [
  "Your payment is locked in your own wallet, held by our licensed payment partner. It doesn't go straight to the seller.",
  "The seller only gets paid after you confirm the order arrived as described, or 3 days after delivery if you don't report a problem.",
  "Something wrong? Open a dispute and we pause the payment until it's sorted.",
];

const SELLER_POINTS = [
  "The buyer's payment is already secured — you won't be scammed with fake alerts.",
  "Ship quickly and add tracking so the buyer can confirm sooner.",
  "Funds move to your wallet when the buyer confirms, or automatically 3 days after delivery.",
];

export const ESCROW_REGION_NOTE = "Escrow and buyer protection apply in Nigeria only. Outside Nigeria you pay sellers directly at your own risk.";

export function EscrowExplainerCard({ viewerRole }: { readonly viewerRole: EscrowViewerRole }) {
  return (
    <section className={styles.notice} aria-labelledby="escrow-explainer-title">
      <h2 id="escrow-explainer-title" className={styles.noticeTitle}>
        <ShieldIcon size={18} /> How escrow protects {viewerRole === "buyer" ? "you" : "your sale"}
      </h2>
      <ul className={styles.points}>
        {(viewerRole === "buyer" ? BUYER_POINTS : SELLER_POINTS).map((point) => <li key={point}>{point}</li>)}
      </ul>
      <p className={styles.faint}>
        {ESCROW_REGION_NOTE} <Link className={styles.link} href="/help/buying-and-orders/how-escrow-protects-your-order">How escrow works</Link>
      </p>
    </section>
  );
}

export function EscrowSummaryCard({ escrow, viewerRole }: { readonly escrow: EscrowDetail; readonly viewerRole: EscrowViewerRole }) {
  const appearance = ESCROW_STAGE_APPEARANCE[escrow.stage];
  const shownAmount = viewerRole === "buyer" ? escrow.heldAmount : escrow.sellerPayoutAmount;
  return (
    <section className={styles.card}>
      <div className={styles.row}>
        <span className={styles.muted}>Order {escrow.orderReference} · {viewerRole === "buyer" ? escrow.store.name : escrow.buyer.name}</span>
        <Badge tone={appearance.tone}>{appearance.label}</Badge>
      </div>
      <span className={styles.faint}>{viewerRole === "buyer" ? "Held in escrow" : "Your payout"}</span>
      <strong className={styles.amount}>{formatMoneyForDisplay(shownAmount)}</strong>
      {viewerRole === "seller" ? (
        <span className={styles.muted}>Buyer paid {formatMoneyForDisplay(escrow.heldAmount)} · Nantty fee {formatMoneyForDisplay(escrow.platformFee)}</span>
      ) : null}
      <span className={styles.releaseLine} data-tone={escrow.stage === "disputed" ? "error" : undefined}>{describeEscrowRelease(escrow)}</span>
    </section>
  );
}

export function EscrowTimeline({ escrow, viewerRole }: { readonly escrow: EscrowDetail; readonly viewerRole: EscrowViewerRole }) {
  const steps = buildEscrowTimelineSteps(escrow, viewerRole);
  return (
    <ol className={styles.timeline}>
      {steps.map((step, index) => (
        <li key={step.key} className={styles.step} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
          <span className={styles.rail} aria-hidden="true">
            <span className={styles.marker}>
              {step.state === "done" ? <CheckIcon size={12} /> : null}
              {step.state === "problem" ? <AlertIcon size={12} /> : null}
            </span>
            {index < steps.length - 1 ? <span className={styles.line} /> : null}
          </span>
          <span className={styles.stepBody}>
            <span className={styles.stepTitle}>{step.title}</span>
            <span className={styles.muted}>{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DisputeStatusHistory({ events }: { readonly events: readonly DisputeStatusEvent[] }) {
  return (
    <ol className={styles.timeline}>
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        return (
          <li key={`${event.status}-${event.occurredAt}`} className={styles.step}>
            <span className={styles.rail} aria-hidden="true">
              <span className={styles.dot} data-tone={isLatest ? DISPUTE_STATUS_APPEARANCE[event.status].tone : undefined} />
              {isLatest ? null : <span className={styles.line} />}
            </span>
            <span className={styles.stepBody}>
              <span className={styles.stepTitle} data-latest={isLatest}>{event.label}</span>
              <span className={styles.faint}>{formatFriendlyDateTime(event.occurredAt)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
