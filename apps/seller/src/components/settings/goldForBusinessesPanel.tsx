"use client";

import { Callout } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge, type StatusTone } from "@/components/ui/statusBadge";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import type { GoldForBusinessesCoverage, GoldForBusinessesDiscountKind, GoldForBusinessesOverview } from "@/types/goldForBusinesses.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";

import styles from "./settings.module.css";

const webappUrl = process.env.NEXT_PUBLIC_WEBAPP_URL ?? "https://app.zudomart.com";
const coverageLabels: Record<GoldForBusinessesCoverage, string> = { active: "Active", removing: "Leaves at renewal", pending: "Pending", none: "Not covered" };
const coverageTones: Record<GoldForBusinessesCoverage, StatusTone> = { active: "success", removing: "caution", pending: "info", none: "neutral" };
const discountKindLabels: Record<GoldForBusinessesDiscountKind, string> = { multi_business: "Multi-business discount", offer: "Offer discount", yearly: "Yearly discount", none: "No discount" };

export function GoldForBusinessesPanel() {
  const { formatMoney } = useMoneyFormatter();
  const { data } = useSellerQuery<GoldForBusinessesOverview>("/subscriptions/gold-for-businesses");
  const subscription = data?.subscription ?? null;
  if (!subscription) return null;
  const managePlansLink = <a href={`${webappUrl}/subscriptions`} target="_blank" rel="noopener noreferrer">Manage on the web</a>;

  return (
    <Panel
      title="Gold for all your businesses"
      description="Your store's Gold checkmark comes from this combined plan, not from this store's own plan."
      actions={<StatusBadge tone={subscription.cancelAtPeriodEnd ? "caution" : "success"}>{subscription.cancelAtPeriodEnd ? "Ends at period end" : "Active"}</StatusBadge>}
    >
      <div className={styles.formStack}>
        {subscription.cancelAtPeriodEnd ? (
          <Callout tone="caution" title="This plan is set to end" action={managePlansLink}>
            Gold stays on every covered business until {formatDateForDisplay(subscription.currentPeriodEnd)}.
          </Callout>
        ) : null}
        <KeyValueList
          items={[
            { label: "Billed", value: subscription.interval === "year" ? "Yearly" : "Monthly" },
            { label: subscription.interval === "year" ? "Price per year" : "Price per month", value: formatMoney(subscription.price) },
            { label: "Discount", value: discountKindLabels[subscription.discountKind] },
            { label: subscription.cancelAtPeriodEnd ? "Ends on" : "Renews on", value: formatDateForDisplay(subscription.currentPeriodEnd) },
          ]}
        />
        <ul className={styles.listReset} aria-label="Businesses covered by this plan">
          {subscription.coveredProfiles.map((profile) => (
            <li key={profile.profileId} className={styles.rowHeader}>
              <span className={styles.rowTitle}>
                {profile.displayName} <span className={styles.mutedText}>{profile.profileType === "brand" ? "Brand" : "Business"}</span>
              </span>
              <StatusBadge tone={coverageTones[profile.coverage]}>{coverageLabels[profile.coverage]}</StatusBadge>
            </li>
          ))}
        </ul>
        <p className={styles.mutedText}>
          Each business still needs its own verification before its Gold checkmark shows. To add or remove businesses or change billing, {managePlansLink}.
        </p>
      </div>
    </Panel>
  );
}
