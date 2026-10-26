"use client";

import { useState } from "react";

import { AffiliateCreatorIdentity } from "@/components/affiliates/affiliateCreatorIdentity";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/filterControls";
import { CheckboxField, FormErrorSummary, SelectField, TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { AffiliateCreator, ProductCommissionRow } from "@/types/affiliate.type";
import type { CursorPage } from "@/types/pagination.type";
import { convertLocalDateTimeInputToIso, convertPercentTextToBasisPoints } from "@/utils/affiliateFormatting.util";

import styles from "./affiliateViews.module.css";

const maximumProductsPerInvitation = 20;
const maximumMessageLength = 500;
const nicheOptions = ["", "Fashion", "Beauty", "Gadgets", "Food", "Home"].map((niche) => ({ value: niche, label: niche || "All niches" }));

export function AffiliateLiveInvitationDialog({ isOpen, onClose, onInvited }: { readonly isOpen: boolean; readonly onClose: () => void; readonly onInvited: () => void }) {
  const { showToast } = useToast();
  const [creatorSearchText, setCreatorSearchText] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<AffiliateCreator | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [startAtText, setStartAtText] = useState("");
  const [commissionText, setCommissionText] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const directoryQuery = useSellerQuery<CursorPage<AffiliateCreator & { isInYourProgram: boolean }>>(isOpen ? "/seller/affiliates/creator-directory" : null, { q: creatorSearchText, niche: nicheFilter, limit: 20 });
  const productsQuery = useSellerQuery<CursorPage<ProductCommissionRow>>(isOpen ? "/seller/affiliates/product-commissions" : null, { limit: 200 });
  const invitableProducts = (productsQuery.data?.data ?? []).filter((product) => !product.excluded);

  function toggleProductSelection(productId: string, isSelected: boolean) {
    setSelectedProductIds((current) => (isSelected ? [...current, productId] : current.filter((candidate) => candidate !== productId)));
  }

  function collectInvitationValidationErrors(): string[] {
    const validationErrors: string[] = [];
    if (!selectedCreator) validationErrors.push("Choose a creator.");
    if (selectedProductIds.length === 0) validationErrors.push("Pick at least one product.");
    if (selectedProductIds.length > maximumProductsPerInvitation) validationErrors.push(`Pick at most ${maximumProductsPerInvitation} products.`);
    const startAtIso = convertLocalDateTimeInputToIso(startAtText);
    if (!startAtIso) validationErrors.push("Pick a start date and time.");
    else if (new Date(startAtIso).getTime() <= Date.now()) validationErrors.push("The live must start in the future.");
    if (commissionText.trim() !== "" && convertPercentTextToBasisPoints(commissionText) === null) validationErrors.push("Live commission must be 0 to 50%, or empty for your default.");
    if (message.trim().length > maximumMessageLength) validationErrors.push(`Keep the message under ${maximumMessageLength} characters.`);
    return validationErrors;
  }

  async function sendLiveInvitation() {
    const validationErrors = collectInvitationValidationErrors();
    setErrors(validationErrors);
    if (validationErrors.length > 0 || !selectedCreator) return;
    setIsSending(true);
    try {
      await sendSellerApiRequest("/seller/affiliates/live-invitations", {
        method: "POST",
        body: { creatorId: selectedCreator.id, productIds: selectedProductIds, proposedStartAt: convertLocalDateTimeInputToIso(startAtText), commissionBasisPoints: commissionText.trim() === "" ? null : convertPercentTextToBasisPoints(commissionText), message: message.trim() },
      });
      showToast(`Invitation sent to @${selectedCreator.username}.`);
      setSelectedCreator(null);
      setSelectedProductIds([]);
      setStartAtText("");
      setCommissionText("");
      setMessage("");
      onInvited();
    } catch (error) {
      setErrors(error instanceof SellerApiRequestError && error.issues?.length ? error.issues.map((issue) => issue.message) : [readErrorMessageForDisplay(error)]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <ModalDialog intent="live"
      isOpen={isOpen}
      title="Invite a creator to live-sell"
      description="The creator gets your invitation in the Nantty app and can accept or decline."
      onClose={onClose}
      width="large"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" iconName="paperPlaneTilt24" isBusy={isSending} onClick={() => void sendLiveInvitation()}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className={styles.formStack}>
        <FormErrorSummary messages={errors} />
        <fieldset className={styles.formStack} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 650, marginBottom: 8 }}>Creator</legend>
          <div className={styles.inlineRow}>
            <SearchInput label="Search creators" value={creatorSearchText} onValueChange={setCreatorSearchText} />
            <SelectField label="Niche" hideLabel options={nicheOptions} value={nicheFilter} onChange={(event) => setNicheFilter(event.target.value)} />
          </div>
          <div className={styles.directoryList}>
            {(directoryQuery.data?.data ?? []).map((creator) => (
              <button key={creator.id} type="button" className={styles.directoryOption} aria-pressed={selectedCreator?.id === creator.id} onClick={() => setSelectedCreator(creator)}>
                <AffiliateCreatorIdentity creator={creator} />
                {creator.isInYourProgram ? <span className={styles.muted}>In your program</span> : null}
              </button>
            ))}
            {directoryQuery.data && directoryQuery.data.data.length === 0 ? <p className={styles.muted}>No creators match.</p> : null}
          </div>
        </fieldset>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 650, marginBottom: 8 }}>
            Products ({selectedProductIds.length} of up to {maximumProductsPerInvitation})
          </legend>
          <div className={styles.productPicker}>
            {invitableProducts.map((product) => (
              <CheckboxField key={product.productId} label={product.productName} checked={selectedProductIds.includes(product.productId)} onCheckedChange={(isSelected) => toggleProductSelection(product.productId, isSelected)} />
            ))}
          </div>
        </fieldset>
        <div className={styles.inlineRow} style={{ alignItems: "flex-start" }}>
          <TextField label="Proposed start" type="datetime-local" value={startAtText} onChange={(event) => setStartAtText(event.target.value)} />
          <TextField label="Live commission (optional)" hint="Empty uses each product's rate." prefix="%" inputMode="decimal" maxLength={5} value={commissionText} onChange={(event) => setCommissionText(event.target.value)} />
        </div>
        <TextAreaField label="Message to the creator" value={message} maxLength={maximumMessageLength + 50} onChange={(event) => setMessage(event.target.value)} hint={`${message.trim().length}/${maximumMessageLength}`} />
      </div>
    </ModalDialog>
  );
}
