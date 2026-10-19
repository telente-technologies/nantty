"use client";

import { useEffect, useRef } from "react";

import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useAdsQuery } from "@/hooks/useAdsQuery.hook";
import { campaignsApi } from "@/services/campaignsApi.service";
import type { PromotableDestination, PromotableDestinationKind } from "@/types/creative.type";

import styles from "./creativeEditor.module.css";

const pickerCopyByKind: Record<PromotableDestinationKind, { readonly label: string; readonly nothingToPromote: string }> = {
  profile: { label: "Profile the button opens", nothingToPromote: "You have no profile you can promote from this ad account." },
  store: { label: "Store the button opens", nothingToPromote: "You have no store you can promote. Only stores you own, or help run as an owner or manager, are listed here." },
};

interface PromotedDestinationPickerProps {
  readonly accountId: string;
  readonly kind: PromotableDestinationKind;
  readonly chosenDestinationId: string | null;
  readonly preferredDestinationId: string | null;
  readonly error?: string;
  readonly onDestinationChosen: (destination: PromotableDestination) => void;
  readonly onNothingToPromoteChange: (kind: PromotableDestinationKind, hasNothingToPromote: boolean) => void;
}

function describeDestinationMeta(destination: PromotableDestination): string {
  if (!destination.eligible) return destination.ineligibleReason ?? "This can't be promoted right now.";
  return destination.private ? `@${destination.handle} · Private account` : `@${destination.handle}`;
}

export function PromotedDestinationPicker({ accountId, kind, chosenDestinationId, preferredDestinationId, error, onDestinationChosen, onNothingToPromoteChange }: PromotedDestinationPickerProps) {
  const destinationsQuery = useAdsQuery(() => campaignsApi.listPromotableDestinations(accountId, kind), `${accountId}-promotable-${kind}`);
  const destinations = (destinationsQuery.data?.items ?? []).filter((destination) => destination.kind === kind);
  const eligibleDestinations = destinations.filter((destination) => destination.eligible);
  const hasLoaded = destinationsQuery.data !== null && !destinationsQuery.isLoading && !destinationsQuery.errorMessage;
  const isChosenStillEligible = eligibleDestinations.some((destination) => destination.id === chosenDestinationId);
  const automaticChoice = isChosenStillEligible ? null : (eligibleDestinations.find((destination) => destination.id === preferredDestinationId) ?? (eligibleDestinations.length === 1 ? eligibleDestinations[0] : null));
  const callbacksRef = useRef({ onDestinationChosen, onNothingToPromoteChange, automaticChoice });
  callbacksRef.current = { onDestinationChosen, onNothingToPromoteChange, automaticChoice };
  const copy = pickerCopyByKind[kind];

  useEffect(() => {
    if (!hasLoaded) return;
    callbacksRef.current.onNothingToPromoteChange(kind, eligibleDestinations.length === 0);
    const choice = callbacksRef.current.automaticChoice;
    if (choice) callbacksRef.current.onDestinationChosen(choice);
  }, [hasLoaded, kind, eligibleDestinations.length, automaticChoice?.id]);

  return (
    <div className={styles.picker}>
      <p className={styles.fieldLabel}>{copy.label}</p>
      {destinationsQuery.errorMessage ? <ErrorState error={destinationsQuery.error} message={destinationsQuery.errorMessage} onRetry={destinationsQuery.reload} /> : null}
      {destinationsQuery.isLoading && destinations.length === 0 ? <LoadingBlock height={72} label={`Loading your ${kind === "store" ? "stores" : "profile"}`} /> : null}
      {hasLoaded && eligibleDestinations.length === 0 && !error ? <p className={styles.muted}>{copy.nothingToPromote}</p> : null}
      <ul className={styles.sourceGrid} role="radiogroup" aria-label={copy.label}>
        {destinations.map((destination) => {
          const isChosen = destination.id === chosenDestinationId;
          return (
            <li key={destination.id}>
              <button type="button" role="radio" aria-checked={isChosen} disabled={!destination.eligible} title={destination.ineligibleReason ?? undefined} className={isChosen ? `${styles.sourceCard} ${styles.sourceCardSelected}` : styles.sourceCard} onClick={() => onDestinationChosen(destination)}>
                <span className={`${styles.sourceThumb} ${styles.destinationAvatar}`}>
                  {destination.avatarUrl ? <img src={destination.avatarUrl} alt="" /> : <ZudoIcon name={kind === "store" ? "buildingStore20" : "userCircle24"} size={22} />}
                </span>
                <span className={styles.sourceText}>
                  <span className={`${styles.sourceTitle} ${styles.destinationName}`}>
                    {destination.name}
                    {destination.verified ? <ZudoIcon name="sealCheck20" size={14} className={styles.destinationSeal} label="Verified" /> : null}
                  </span>
                  <span className={styles.sourceMeta}>{describeDestinationMeta(destination)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
