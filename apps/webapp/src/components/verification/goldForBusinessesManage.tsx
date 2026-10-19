"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { goldForBusinessesService } from "@/services/goldForBusinesses.service";
import type { ID } from "@/types";
import type { GoldForBusinessesBusiness, GoldForBusinessesState, GoldForBusinessesSubscription } from "@/types/goldForBusinesses.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { formatSubscriptionDay } from "@/utils/creatorSubscriptions.util";
import { openHostedCheckout } from "@/utils/hostedCheckout.util";

import { GoldBusinessCheckboxList } from "./goldBusinessCheckboxList";
import styles from "./goldForBusinesses.module.css";

const keptProfileIds = (subscription: GoldForBusinessesSubscription) => subscription.coveredProfiles.filter((profile) => profile.coverage !== "removing").map((profile) => profile.profileId);

function mergeBusinesses(state: GoldForBusinessesState, subscription: GoldForBusinessesSubscription): GoldForBusinessesBusiness[] {
  const covered = new Map(subscription.coveredProfiles.map((profile) => [profile.profileId, profile]));
  const others = state.businesses.filter((business) => !covered.has(business.profileId));
  return [...subscription.coveredProfiles, ...others];
}

export function GoldForBusinessesManage({ state, subscription, onChanged }: { readonly state: GoldForBusinessesState; readonly subscription: GoldForBusinessesSubscription; readonly onChanged: () => void }) {
  const [selected, setSelected] = useState<ReadonlySet<ID>>(() => new Set(keptProfileIds(subscription)));
  const [actionBlocked, setActionBlocked] = useState(false);
  const change = useMutation({
    mutationFn: () => goldForBusinessesService.changeGoldForBusinessesProfiles(subscription.id, [...selected]),
    onSuccess: (result) => {
      if (result.actionUrl && openHostedCheckout({ authorizationUrl: result.actionUrl, reference: subscription.id }) === "blocked") setActionBlocked(true);
      onChanged();
    },
  });
  const toggle = (profileId: ID) => {
    change.reset();
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(profileId)) next.add(profileId);
      return next;
    });
  };
  const original = keptProfileIds(subscription);
  const unchanged = original.length === selected.size && original.every((id) => selected.has(id));
  const renewsOn = formatSubscriptionDay(subscription.currentPeriodEnd);
  const result = change.data;
  const currency = subscription.price.currency;
  return (
    <>
      <p className={styles.note}>
        {formatMoneyForDisplay(subscription.price)} / {subscription.interval === "year" ? "year" : "month"} · {subscription.status}
        {renewsOn ? ` · ${subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} ${renewsOn}` : ""}
      </p>
      {state.premium ? null : (
        <p className={styles.error} role="status">Your Blue Premium has lapsed. Covered businesses keep Gold, and the plan renews at full price. Get Blue Premium again to add businesses.</p>
      )}
      <GoldBusinessCheckboxList businesses={mergeBusinesses(state, subscription)} selected={selected} maximumProfiles={state.rules.maximumProfiles} canAddMore={state.premium} onToggle={toggle} />
      <p className={styles.note}>Businesses you add are charged now for the rest of this period. Businesses you remove keep Gold until renewal, then leave the plan.</p>
      {result ? (
        <p className={styles.note} role="status">
          {result.added.length > 0 ? `Charged now: ${formatMoneyForDisplay({ amountMinor: result.charge.amountDueMinor, currency })}. ` : ""}
          {result.removing.length > 0 ? `Removed businesses keep Gold until ${formatSubscriptionDay(result.removalsEffectiveAt) ?? "renewal"}.` : ""}
          {result.chargeStatus === "failed" ? " The payment didn't go through. Check your card and try again." : ""}
        </p>
      ) : null}
      {actionBlocked ? <p className={styles.error} role="alert">We couldn&apos;t open the payment confirmation. Try again in a moment.</p> : null}
      {change.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(change.error)}</p> : null}
      <div>
        <Button busy={change.isPending} disabled={unchanged || selected.size === 0} onClick={() => change.mutate()}>Save businesses</Button>
      </div>
    </>
  );
}
