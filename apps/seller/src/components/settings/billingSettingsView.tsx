"use client";

import { useState } from "react";

import { TrialOfferNotice } from "@/components/billing/trialOfferNotice";
import { TrialReminderCallout, TrialStatusPanel } from "@/components/billing/trialStatusPanel";
import { SubscriptionPlanPicker } from "@/components/billing/subscriptionPlanPicker";
import { GoldForBusinessesPanel } from "@/components/settings/goldForBusinessesPanel";
import { planFeatureDescriptions, sellerPlanLabels, type PlanFeature } from "@/config/planFeatures.config";
import { usePlanFeatures } from "@/hooks/usePlanFeatures.hook";
import { describePlanEntitlements } from "@/utils/goldEntitlements.util";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/dataTable";
import { Callout, ErrorCallout, LoadingBlock } from "@/components/ui/feedback";
import { ModalDialog } from "@/components/ui/modalDialog";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BillingOffer } from "@/types/billingOffer.type";
import type { SubscriptionStatus } from "@/types/sellerAccess.type";
import type { SubscriptionDetails, SubscriptionInvoice } from "@/types/subscription.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

const subscriptionStatusTone: Record<SubscriptionStatus, StatusTone> = { trialing: "info", active: "success", past_due: "caution", cancelled: "neutral", expired: "neutral", suspended: "error" };
const subscriptionStatusLabel: Record<SubscriptionStatus, string> = { trialing: "Trial", active: "Active", past_due: "Payment overdue", cancelled: "Cancelled", expired: "Expired", suspended: "Suspended" };

export function BillingSettingsView() {
  const { sessionView } = useSellerSession();
  const { formatMoney } = useMoneyFormatter();
  const { showToast } = useToast();
  const subscriptionQuery = useSellerQuery<SubscriptionDetails>("/seller/subscription");
  const offerQuery = useSellerQuery<BillingOffer>("/seller/subscription/trial");
  const offer = offerQuery.data;
  const [pendingAction, setPendingAction] = useState<"cancel" | "resume" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const details = subscriptionQuery.data;
  const subscription = details?.subscription ?? null;
  const entitlements = sessionView?.access.entitlements ?? null;
  const { plan } = usePlanFeatures();
  const requestedFeature = typeof window === "undefined" ? null : (new URLSearchParams(window.location.search).get("feature") as PlanFeature | null);

  async function confirmSubscriptionChange() {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      await sendSellerApiRequest(`/seller/subscription/${pendingAction}`, { method: "POST" });
      showToast(pendingAction === "cancel" ? "Your plan will end at the close of this period. You keep Free after that." : "Your plan will renew as normal.");
      subscriptionQuery.reload();
      setPendingAction(null);
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (subscriptionQuery.isLoading && !details) return <LoadingBlock label="Loading your plan" />;
  if (!details) return <ErrorCallout variant="section" error={subscriptionQuery.error} message={subscriptionQuery.errorMessage ?? "Your plan could not be loaded."} onRetry={subscriptionQuery.reload} />;

  return (
    <>
      {requestedFeature && planFeatureDescriptions[requestedFeature] ? (
        <Callout tone="info" title={`${planFeatureDescriptions[requestedFeature].title} needs an upgrade`}>
          {planFeatureDescriptions[requestedFeature].description} Pick a plan below to switch it on.
        </Callout>
      ) : null}
      <Callout tone="info" title={`Billing for ${offer?.profileName ?? sessionView?.access.storeName ?? "this business profile"}`}>
        Each business or brand profile has its own plan, invoices and payment method. Gold comes with Pro and Business, and only shows once the business is verified.
      </Callout>
      {offer?.activeTrial ? <TrialReminderCallout trial={offer.activeTrial} onCancelled={() => { offerQuery.reload(); subscriptionQuery.reload(); }} /> : null}
      {offer?.activeTrial ? <TrialStatusPanel trial={offer.activeTrial} onChanged={() => { offerQuery.reload(); subscriptionQuery.reload(); }} /> : null}
      {offer && plan === "free" ? <TrialOfferNotice offer={offer} /> : null}
      <Panel
        title={`${sellerPlanLabels[plan]} plan`}
        description={plan === "free" ? "You are on Free. Every basic selling tool is included — upgrade when you need more." : "Thanks for growing with Zudomart."}
        actions={subscription ? <StatusBadge tone={subscriptionStatusTone[subscription.status]}>{subscriptionStatusLabel[subscription.status]}</StatusBadge> : null}
      >
        <div className={styles.formStack}>
          {details.cancelAtPeriodEnd && subscription ? (
            <Callout tone="caution" title="Your plan is set to end" action={<Button size="small" onClick={() => setPendingAction("resume")}>Keep my plan</Button>}>
              Paid features stop on {formatDateForDisplay(subscription.currentPeriodEnd)}. You keep the dashboard on Free.
            </Callout>
          ) : null}
          <KeyValueList
            items={[
              { label: details.cancelAtPeriodEnd ? "Ends on" : "Renews on", value: formatDateForDisplay(subscription?.currentPeriodEnd) },
              { label: "Payment method", value: details.paymentMethodSummary ?? "—" },
              { label: "Paid through", value: details.provider === "flutterwave" ? "Flutterwave" : details.provider ? "Card / bank transfer" : "—" },
              ...(offer?.accountEmail ? [{ label: "Receipts go to", value: offer.accountEmail }] : []),
            ]}
          />
          {entitlements ? (
            <ul className={styles.categoryChecklist} aria-label="Included in your plan">
              {describePlanEntitlements(entitlements).map((description) => (
                <li key={description} className={styles.rowTitle}>
                  <ZudoIcon name="check16" size={14} /> {description}
                </li>
              ))}
            </ul>
          ) : null}
          {subscription && !details.cancelAtPeriodEnd ? (
            <div>
              <Button variant="ghost" onClick={() => setPendingAction("cancel")}>
                Cancel at end of period
              </Button>
            </div>
          ) : null}
        </div>
      </Panel>
      <GoldForBusinessesPanel />
      <Panel title="Change plan" description="Switching opens our payment partner's page. You come straight back here after paying.">
        <SubscriptionPlanPicker currentPlanId={details.planId} currentPlan={plan} offer={offer} />
      </Panel>
      <Panel title="Invoices" padded={false}>
        <DataTable<SubscriptionInvoice>
          caption="Plan invoices"
          rows={details.invoices}
          readRowKey={(invoice) => invoice.id}
          emptyState="No invoices yet."
          columns={[
            { key: "number", header: "Invoice", render: (invoice) => invoice.number },
            { key: "period", header: "Period", render: (invoice) => `${formatDateForDisplay(invoice.periodStart)} – ${formatDateForDisplay(invoice.periodEnd)}`, hideBelowTablet: true },
            { key: "amount", header: "Amount", align: "end", render: (invoice) => formatMoney(invoice.amount) },
            { key: "status", header: "Status", render: (invoice) => <StatusBadge tone={invoice.status === "paid" ? "success" : invoice.status === "failed" ? "error" : "caution"}>{invoice.status === "paid" ? "Paid" : invoice.status === "failed" ? "Failed" : "Open"}</StatusBadge> },
          ]}
        />
      </Panel>
      <ModalDialog intent="subscribe"
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        width="small"
        title={pendingAction === "cancel" ? "Cancel your plan?" : "Keep your plan?"}
        footer={
          <>
            <Button onClick={() => setPendingAction(null)}>Not now</Button>
            <Button variant={pendingAction === "cancel" ? "danger" : "primary"} isBusy={isSubmitting} onClick={() => void confirmSubscriptionChange()}>
              {pendingAction === "cancel" ? "Cancel at end of period" : "Keep my plan"}
            </Button>
          </>
        }
      >
        {pendingAction === "cancel"
          ? `You keep paid features until ${formatDateForDisplay(subscription?.currentPeriodEnd)}. After that your store moves to Free: products, orders and payouts keep working, and Pro or Business tools lock until you upgrade again.`
          : "Your plan will renew automatically at the end of this period."}
      </ModalDialog>
    </>
  );
}
