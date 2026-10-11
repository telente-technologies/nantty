"use client";

import { useEffect, useState } from "react";

import { useBrandWorkspace } from "@/components/brand/brandWorkspace";
import { Button } from "@/components/ui/button";
import { CheckboxField, FormErrorSummary, SelectField, TextAreaField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, SellerApiRequestError, sendSellerApiRequest } from "@/services/clientApi.service";
import type { BrandClaimKind, BrandListingReport } from "@/types/brand.type";
import { brandClaimKindLabels } from "@/utils/brandPresentation.util";

const claimKinds: BrandClaimKind[] = ["counterfeit", "trademark", "unauthorised_seller"];
const maximumListingsPerClaim = 20;

interface BrandClaimDialogProps {
  readonly isOpen: boolean;
  readonly selectedListings: readonly BrandListingReport[];
  readonly onClose: () => void;
  readonly onFiled: () => void;
}

export function BrandClaimDialog({ isOpen, selectedListings, onClose, onFiled }: BrandClaimDialogProps) {
  const { brand } = useBrandWorkspace();
  const { showToast } = useToast();
  const [kind, setKind] = useState<BrandClaimKind>("counterfeit");
  const [evidence, setEvidence] = useState("");
  const [isDeclarationConfirmed, setIsDeclarationConfirmed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFiling, setIsFiling] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors([]);
    setIsDeclarationConfirmed(false);
  }, [isOpen]);

  async function fileBrandClaim() {
    const nextErrors: string[] = [];
    if (selectedListings.length < 1 || selectedListings.length > maximumListingsPerClaim) nextErrors.push(`Select between 1 and ${maximumListingsPerClaim} listings.`);
    if (evidence.trim().length < 30 || evidence.trim().length > 2000) nextErrors.push("Describe your evidence in 30 to 2,000 characters.");
    if (!isDeclarationConfirmed) nextErrors.push("Confirm the declaration before filing.");
    setErrors(nextErrors);
    if (nextErrors.length > 0) return;
    setIsFiling(true);
    try {
      await sendSellerApiRequest(`/seller/brands/${encodeURIComponent(brand.id)}/protection/claims`, {
        method: "POST",
        body: { kind, listingIds: selectedListings.map((listing) => listing.id), evidence: evidence.trim(), declaration: true },
      });
      showToast("Claim filed. The Zudomart brand team usually replies within 2 working days.");
      setEvidence("");
      onFiled();
    } catch (error) {
      setErrors(error instanceof SellerApiRequestError && error.issues?.length ? error.issues.map((issue) => issue.message) : [readErrorMessageForDisplay(error)]);
    } finally {
      setIsFiling(false);
    }
  }

  return (
    <ModalDialog intent="copyright"
      isOpen={isOpen}
      onClose={onClose}
      title="File a brand claim"
      description={`${selectedListings.length} listing${selectedListings.length === 1 ? "" : "s"} selected. Zudomart reviews every claim before anything is taken down.`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" isBusy={isFiling} onClick={() => void fileBrandClaim()}>File claim</Button></>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormErrorSummary messages={errors} />
        <ul style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          {selectedListings.map((listing) => (
            <li key={listing.id}>
              {listing.title} · @{listing.sellerHandle}
            </li>
          ))}
        </ul>
        <SelectField label="What is wrong?" value={kind} onChange={(event) => setKind(event.target.value as BrandClaimKind)} options={claimKinds.map((candidate) => ({ value: candidate, label: brandClaimKindLabels[candidate] }))} />
        <TextAreaField label="Evidence" value={evidence} maxLength={2000} onChange={(event) => setEvidence(event.target.value)} hint={`What shows these are not genuine or not authorised: test purchases, differences from your product, your trademark number. ${evidence.trim().length}/2000`} />
        <CheckboxField checked={isDeclarationConfirmed} onCheckedChange={setIsDeclarationConfirmed} label={`I confirm this claim is true and that I own or am authorised to act for ${brand.name}. False claims can lead to losing brand protection.`} />
      </div>
    </ModalDialog>
  );
}
