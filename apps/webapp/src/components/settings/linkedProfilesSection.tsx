"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useStepUpPrompt } from "@/components/wallet/stepUpDialog";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirmDialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { linkedProfilesService } from "@/services/linkedProfiles.service";
import type { LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";
import { activeBrand, activeStoreOrBusiness, LINKED_KIND_LABELS } from "@/utils/linkedProfiles.util";

import styles from "./settings.module.css";

const queryKey = ["users", "me", "linked-profiles"] as const;

export function LinkedProfilesSection() {
  const linked = useQuery({ queryKey, queryFn: linkedProfilesService.fetchMine, retry: false });
  if (linked.isPending) return <Skeleton height={160} />;
  if (linked.isError) return <ErrorState error={linked.error} onRetry={() => void linked.refetch()} />;
  if (linked.data.choiceRequired) return <ChooseWhichToKeep linked={linked.data} />;
  const storeOrBusiness = activeStoreOrBusiness(linked.data);
  const brand = activeBrand(linked.data);
  return (
    <>
      <p className={styles.muted}>Your account can have one Store or one Business page, never both, plus one Brand.</p>
      <section aria-labelledby="store-or-business-heading" className={styles.block}>
        <h2 id="store-or-business-heading" className={styles.blockHeading}>Store or Business page</h2>
        {storeOrBusiness ? (
          <p className={styles.muted}>You already have a {LINKED_KIND_LABELS[storeOrBusiness.kind]}: {storeOrBusiness.name || "pending review"}.</p>
        ) : (
          <>
            <p className={styles.muted}>A Store sells in Mart and shows the Mart icon. A Business page is for organisations that don&apos;t sell, so it has no Mart icon or products. Pick one.</p>
            <div className={styles.buttonRow}>
              <Link href="/seller/apply" className={styles.choiceChip}>Open a store</Link>
            </div>
            <p className={styles.muted}>Business pages are created in the Zudomart app.</p>
          </>
        )}
      </section>
      <section aria-labelledby="brand-heading" className={styles.block}>
        <h2 id="brand-heading" className={styles.blockHeading}>Brand</h2>
        <p className={styles.muted}>
          {brand ? `You already have a Brand: ${brand.name}. Turn selling on or off in brand settings.` : "You don't have a Brand yet. Brands are created in the Zudomart app."}
        </p>
      </section>
    </>
  );
}

function ChooseWhichToKeep({ linked }: { readonly linked: LinkedProfiles }) {
  const queryClient = useQueryClient();
  const { withStepUp, stepUpDialog } = useStepUpPrompt();
  const candidates = linked.items.filter((item) => item.status !== "retired");
  const slotOptions = candidates.filter((item) => item.kind !== "brand");
  const brandOptions = candidates.filter((item) => item.kind === "brand");
  const [slot, setSlot] = useState(slotOptions.find((item) => item.status === "active")?.profileId ?? null);
  const [brand, setBrand] = useState(brandOptions.find((item) => item.status === "active")?.profileId ?? null);
  const choose = useMutation({
    mutationFn: () => withStepUp((token) => linkedProfilesService.chooseWhichToKeep([slot, brand].filter((id): id is string => id !== null), token)),
    onSuccess: (summary) => queryClient.setQueryData(queryKey, summary),
  });
  const confirmAndChoose = async () => {
    const confirmed = await requestConfirmation({ title: "Keep these profiles?", description: "The ones you don't keep stay visible but can't post or list anything new. Open orders and payouts carry on.", confirmLabel: "Keep selected" });
    if (confirmed) choose.mutate();
  };
  return (
    <section aria-labelledby="choose-heading" className={styles.block}>
      <h2 id="choose-heading" className={styles.blockHeading}>Choose which to keep</h2>
      <p className={styles.muted}>Your account has more profiles than the rule allows. Nothing is deleted. Until you choose, the extra profiles can&apos;t post or add listings.</p>
      {slotOptions.length > 0 ? <ChoiceGroup title="Store or Business page" options={slotOptions} selected={slot} onSelect={setSlot} /> : null}
      {brandOptions.length > 0 ? <ChoiceGroup title="Brand" options={brandOptions} selected={brand} onSelect={setBrand} /> : null}
      {choose.isError ? <p className={styles.errorText} role="alert">{readErrorMessageForDisplay(choose.error)}</p> : null}
      <div className={styles.buttonRow}>
        <Button busy={choose.isPending} onClick={() => void confirmAndChoose()}>Keep selected profiles</Button>
      </div>
      {stepUpDialog}
    </section>
  );
}

function ChoiceGroup({ title, options, selected, onSelect }: { readonly title: string; readonly options: readonly LinkedProfileItem[]; readonly selected: string | null; readonly onSelect: (id: string) => void }) {
  return (
    <div className={styles.block}>
      <h3 className={styles.subHeading}>{title}</h3>
      <div className={styles.buttonRow} role="radiogroup" aria-label={title}>
        {options.map((option) => (
          <button key={option.profileId} type="button" role="radio" aria-checked={option.profileId === selected} className={styles.choiceChip} onClick={() => onSelect(option.profileId)}>
            {option.name || "Untitled"} · {LINKED_KIND_LABELS[option.kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
