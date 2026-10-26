"use client";

import { useEffect, useState } from "react";

import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StorefrontDeliveryAreasSummary, StorefrontOpeningHoursSection, StorefrontPoliciesSection, StorefrontSocialLinksSection } from "@/components/storefront/storefrontDetailsSections";
import { convertStorefrontDraftToUpdateRequest, convertStorefrontProfileToDraft, findStorefrontDraftProblems, type StorefrontDraft } from "@/components/storefront/storefrontDraft.util";
import { StorefrontFeaturedProductsSection } from "@/components/storefront/storefrontFeaturedProductsSection";
import { StorefrontIdentitySection } from "@/components/storefront/storefrontIdentitySection";
import { StorefrontPreviewCard } from "@/components/storefront/storefrontPreviewCard";
import { Button } from "@/components/ui/button";
import { Callout, LoadingBlock } from "@/components/ui/feedback";
import { FormErrorSummary } from "@/components/ui/formFields";
import { PageHeader, PageStack } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toastProvider";
import { ZudoIcon } from "@/components/ui/zudoIcon";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import { readErrorMessageForDisplay, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { StorefrontProfile } from "@/types/storefront.type";
import { formatRelativeTimeFromNow } from "@/utils/dateFormatting.util";

import styles from "./storefront.module.css";

export function StorefrontView() {
  const storefrontQuery = useSellerQuery<StorefrontProfile>("/seller/storefront");
  const { refreshSessionView } = useSellerSession();
  const { reloadStoreContext } = useStoreContext();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<StorefrontDraft | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const profile = storefrontQuery.data;

  useEffect(() => {
    if (profile) setDraft(convertStorefrontProfileToDraft(profile));
  }, [profile]);

  const hasUnsavedChanges = Boolean(profile && draft && JSON.stringify(convertStorefrontDraftToUpdateRequest(draft)) !== JSON.stringify(convertStorefrontDraftToUpdateRequest(convertStorefrontProfileToDraft(profile))));

  function updateStorefrontDraft(patch: Partial<StorefrontDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function saveStorefrontChanges() {
    if (!draft) return;
    const problems = findStorefrontDraftProblems(draft);
    setErrorMessages(problems);
    if (problems.length > 0) return;
    setIsSaving(true);
    try {
      const saved = await sendSellerApiRequest<StorefrontProfile>("/seller/storefront", { method: "PATCH", body: convertStorefrontDraftToUpdateRequest(draft) });
      storefrontQuery.replaceData(() => saved);
      reloadStoreContext();
      void refreshSessionView();
      showToast("Storefront saved. Buyers see the changes in the app straight away.");
    } catch (error) {
      if (error instanceof SellerApiRequestError && error.issues?.length) setErrorMessages(error.issues.map((issue) => issue.message));
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageStack>
      <PageHeader
        title="Storefront"
        description="Your store page in the Nantty app: name, look, policies, hours and the products you want buyers to see first."
        actions={
          <>
            {profile ? (
              <a href={profile.publicUrl} target="_blank" rel="noopener noreferrer" className={styles.muted}>
                View my store <ZudoIcon name="arrowUpRight24" size={14} />
              </a>
            ) : null}
            <Button variant="primary" isBusy={isSaving} disabled={!hasUnsavedChanges} onClick={() => void saveStorefrontChanges()}>
              Save storefront
            </Button>
          </>
        }
      />
      {storefrontQuery.isLoading && !profile ? <LoadingBlock label="Loading your storefront" /> : null}
      {storefrontQuery.errorMessage && !profile ? (
        <Callout tone="error" title="Your storefront could not load" action={<Button size="small" onClick={storefrontQuery.reload}>Try again</Button>}>
          {storefrontQuery.errorMessage}
        </Callout>
      ) : null}
      {profile && draft ? (
        <div className={styles.layout}>
          <div className={styles.formColumn}>
            <FormErrorSummary messages={errorMessages} />
            {hasUnsavedChanges ? <Callout tone="caution">You have unsaved changes.</Callout> : null}
            <StorefrontIdentitySection draft={draft} onDraftChange={updateStorefrontDraft} />
            <StorefrontFeaturedProductsSection draft={draft} onDraftChange={updateStorefrontDraft} />
            <StorefrontPoliciesSection draft={draft} onDraftChange={updateStorefrontDraft} />
            <StorefrontOpeningHoursSection draft={draft} onDraftChange={updateStorefrontDraft} />
            <StorefrontSocialLinksSection draft={draft} onDraftChange={updateStorefrontDraft} />
            <StorefrontDeliveryAreasSummary deliveryAreas={profile.deliveryAreas} />
          </div>
          <aside className={styles.previewColumn} aria-label="Live preview">
            <StorefrontPreviewCard draft={draft} profile={profile} />
            <p className={styles.muted}>Live preview · last saved {formatRelativeTimeFromNow(profile.updatedAt)}</p>
          </aside>
        </div>
      ) : null}
    </PageStack>
  );
}
