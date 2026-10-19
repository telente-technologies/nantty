"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readErrorMessageForDisplay, WebappRequestError } from "@/services/clientApi.service";
import { goldForBusinessesService } from "@/services/goldForBusinesses.service";
import type { ID } from "@/types";
import type { GoldBillingInterval, GoldForBusinessesState } from "@/types/goldForBusinesses.type";
import { readGoldForBusinessesHandoffFromLocation } from "@/utils/goldForBusinessesHandoff.util";
import { formatBasisPointsAsPercent } from "@/utils/goldForBusinessesQuote.util";

import { GoldBusinessCheckboxList } from "./goldBusinessCheckboxList";
import styles from "./goldForBusinesses.module.css";
import { GoldQuoteBreakdown } from "./goldQuoteBreakdown";

const isPriceChangedError = (error: unknown) => error instanceof WebappRequestError && error.code === "PRICE_CHANGED";

export function GoldForBusinessesPurchase({ state, onActivated }: { readonly state: GoldForBusinessesState; readonly onActivated: () => void }) {
  const [handoff] = useState(() => readGoldForBusinessesHandoffFromLocation(state));
  const [selected, setSelected] = useState<ReadonlySet<ID>>(() => new Set(handoff.profileIds));
  const [interval, setBillingInterval] = useState<GoldBillingInterval>(handoff.interval);
  const [priceChanged, setPriceChanged] = useState(false);
  const profileIds = [...selected].sort();
  const quote = useQuery({
    queryKey: ["subscriptions", "gold-for-businesses", "quote", profileIds, interval],
    queryFn: ({ signal }) => goldForBusinessesService.quoteGoldForBusinesses({ profileIds, interval }, signal),
    enabled: profileIds.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const checkout = useMutation({
    mutationFn: (expectedTotalMinor: number) =>
      goldForBusinessesService.startGoldForBusinessesCheckout({ profileIds, interval, returnTo: `${window.location.origin}/verification`, expectedTotalMinor }),
    onSuccess: (started) => {
      if (started.activated || !started.authorizationUrl) {
        onActivated();
        return;
      }
      window.location.assign(started.authorizationUrl);
    },
    onError: (error) => {
      if (!isPriceChangedError(error)) return;
      setPriceChanged(true);
      void quote.refetch();
    },
  });
  const toggle = (profileId: ID) => {
    setPriceChanged(false);
    checkout.reset();
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(profileId)) next.add(profileId);
      return next;
    });
  };
  const chooseInterval = (next: GoldBillingInterval) => {
    setPriceChanged(false);
    checkout.reset();
    setBillingInterval(next);
  };
  const currentQuote = quote.data && !quote.isPlaceholderData && profileIds.length > 0 ? quote.data : null;
  return (
    <>
      <GoldBusinessCheckboxList businesses={state.businesses} selected={selected} maximumProfiles={state.rules.maximumProfiles} canAddMore onToggle={toggle} />
      <div className={styles.chips} role="group" aria-label="Billing interval">
        <button type="button" className={styles.chip} aria-pressed={interval === "month"} onClick={() => chooseInterval("month")}>Monthly</button>
        <button type="button" className={styles.chip} aria-pressed={interval === "year"} onClick={() => chooseInterval("year")}>Yearly (extra {formatBasisPointsAsPercent(state.rules.yearlyExtraBps)} off)</button>
      </div>
      {profileIds.length === 0 ? <p className={styles.note}>Tick the businesses you want Gold for.</p> : null}
      {quote.isFetching && !currentQuote && profileIds.length > 0 ? <p className={styles.note} role="status">Getting your price…</p> : null}
      {quote.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(quote.error)}</p> : null}
      {currentQuote ? <GoldQuoteBreakdown quote={currentQuote} /> : null}
      {priceChanged && currentQuote ? <p className={styles.error} role="alert">The price changed. Check the new total before you pay.</p> : null}
      {checkout.isError && !isPriceChangedError(checkout.error) ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(checkout.error)}</p> : null}
      {currentQuote && !currentQuote.canBuyOnWeb ? <p className={styles.note}>This plan can't be bought on the web from your region yet.</p> : null}
      <div>
        <Button busy={checkout.isPending} disabled={!currentQuote || !currentQuote.canBuyOnWeb || quote.isFetching} onClick={() => currentQuote && checkout.mutate(currentQuote.total.amountMinor)}>
          Continue to checkout
        </Button>
      </div>
    </>
  );
}
