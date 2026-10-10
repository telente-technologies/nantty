import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { COPYRIGHT_ACCURACY_DECLARATION, COPYRIGHT_GOOD_FAITH_DECLARATION, COPYRIGHT_SIGNATURE_EXPLANATION } from "@/constants/copyrightLegal.constant";
import { useTheme } from "@/theme";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { copyrightClaimsService, isValidContactEmailAddress, isValidEvidenceLink, splitEvidenceLinks } from "@/services/moderation/copyrightClaims.service";
import type { CopyrightClaimScope, CopyrightClaimTargetType, ID } from "@/types";

import { ClaimCheckbox, ClaimTextField, useClaimFieldStyles } from "./copyrightClaimFields";
import { CopyrightEvidencePicker, resolveEvidenceMediaIds, type EvidenceAttachment } from "./copyrightEvidencePicker";
import { CopyrightSegmentsEditor, segmentDraftsToSeconds, type SegmentDraft } from "./copyrightSegmentsEditor";

export interface CopyrightClaimFormProps {
  readonly targetType: CopyrightClaimTargetType;
  readonly targetId: ID;
  readonly onSubmitted: () => void;
}

const describeClaimedContent = (targetType: CopyrightClaimTargetType, targetId: ID) =>
  `${{ clip: "Clip", sound: "Sound", post: "Post", live: "Live video" }[targetType]} · ${targetId}`;

export function CopyrightClaimForm({ targetType, targetId, onSubmitted }: CopyrightClaimFormProps) {
  const { colors } = useTheme();
  const styles = useClaimFieldStyles();
  const [claimScope, setClaimScope] = useState<CopyrightClaimScope>(targetType === "sound" ? "audio" : "video");
  const [claimantName, setClaimantName] = useState("");
  const [organization, setOrganization] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [claimantPhone, setClaimantPhone] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [originalWorkUrl, setOriginalWorkUrl] = useState("");
  const [ownershipStatement, setOwnershipStatement] = useState("");
  const [proofLinks, setProofLinks] = useState("");
  const [proofAttachments, setProofAttachments] = useState<EvidenceAttachment[]>([]);
  const [segmentDrafts, setSegmentDrafts] = useState<SegmentDraft[]>([{ start: "", end: "" }]);
  const [hasDeclaredGoodFaith, setHasDeclaredGoodFaith] = useState(false);
  const [hasDeclaredAccuracy, setHasDeclaredAccuracy] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const idempotencyKeyForThisClaim = useRef(generateIdempotencyKey());

  const proofUrls = splitEvidenceLinks(proofLinks);
  const segments = segmentDraftsToSeconds(segmentDrafts);
  const isContactEmailValid = isValidContactEmailAddress(contactEmail);
  const isOriginalWorkLinkValid = originalWorkUrl.trim() === "" || isValidEvidenceLink(originalWorkUrl);
  const areProofLinksValid = proofUrls.every(isValidEvidenceLink);
  const doesSignatureMatch = signatureName.trim() !== "" && signatureName.trim().toLowerCase() === claimantName.trim().toLowerCase();
  const needsSegments = targetType !== "sound";
  const canSubmitClaim =
    claimantName.trim().length >= 2 && isContactEmailValid && workDescription.trim().length >= 10 && ownershipStatement.trim().length >= 10 &&
    (originalWorkUrl.trim() !== "" || proofAttachments.length > 0) && isOriginalWorkLinkValid && areProofLinksValid && proofUrls.length + proofAttachments.length > 0 &&
    segments.isValid && (!needsSegments || segments.segments.length > 0) && hasDeclaredGoodFaith && hasDeclaredAccuracy && doesSignatureMatch;

  const submitClaim = useMutation({
    mutationFn: async () => {
      const proofMediaIds = await resolveEvidenceMediaIds(proofAttachments);
      return copyrightClaimsService.submitCopyrightClaim(
        {
          targetType, targetId, claimScope, claimantName: claimantName.trim(), organization: organization.trim() || undefined, claimantPhone: claimantPhone.trim() || undefined,
          workDescription: workDescription.trim(), ownershipStatement: ownershipStatement.trim(), contactEmail: contactEmail.trim(), originalWorkUrl: originalWorkUrl.trim() || undefined,
          originalWorkMediaId: originalWorkUrl.trim() === "" ? proofMediaIds[0] : undefined, proofUrls, proofMediaIds, segments: segments.segments,
          goodFaith: true, accuracyDeclared: true, signatureName: signatureName.trim(),
        },
        idempotencyKeyForThisClaim.current,
      );
    },
    onSuccess: onSubmitted,
  });

  return (
    <View style={layout.root}>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Content being claimed: {describeClaimedContent(targetType, targetId)}
      </Text>
      <View style={styles.field}>
        <Text size={13} weight={500} lineHeight={16.9}>
          What is being used without permission?
        </Text>
        <View style={styles.scopeRow}>
          <Chip label="The audio (music or sound)" selected={claimScope === "audio"} onPress={() => setClaimScope("audio")} />
          <Chip label="The video itself" selected={claimScope === "video"} onPress={() => setClaimScope("video")} />
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          {claimScope === "audio" ? "If upheld, we mute the audio and keep the video up." : "If upheld, the uploader is asked to remove it, and we take it down if they don't."}
        </Text>
      </View>

      <Text size={14} weight={600} lineHeight={18.2} style={styles.sectionTitle}>About you</Text>
      <ClaimTextField label="Full legal name" value={claimantName} onChangeText={setClaimantName} autoComplete="name" maximumLength={120} />
      <ClaimTextField label="Company or label (optional)" value={organization} onChangeText={setOrganization} maximumLength={160} />
      <ClaimTextField label="Contact email" value={contactEmail} onChangeText={setContactEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" maximumLength={254}
        errorMessage={contactEmail.length > 0 && !isContactEmailValid ? "Enter a valid email address" : null} />
      <ClaimTextField label="Phone (optional)" value={claimantPhone} onChangeText={setClaimantPhone} keyboardType="phone-pad" autoComplete="tel" maximumLength={40} />

      <Text size={14} weight={600} lineHeight={18.2} style={styles.sectionTitle}>Your original work</Text>
      <ClaimTextField label="Describe your copyrighted work" value={workDescription} onChangeText={setWorkDescription} placeholder="e.g. my song “Owambe Nights”, released 2024" multiline />
      <ClaimTextField label="Link to the original" value={originalWorkUrl} onChangeText={setOriginalWorkUrl} placeholder="https://" keyboardType="url" autoCapitalize="none" maximumLength={2048}
        errorMessage={isOriginalWorkLinkValid ? null : "Enter a full link starting with https://"} hint="Or upload it below as your first attachment." />
      <CopyrightSegmentsEditor drafts={segmentDrafts} onChange={setSegmentDrafts} />

      <Text size={14} weight={600} lineHeight={18.2} style={styles.sectionTitle}>Proof of ownership</Text>
      <ClaimTextField label="How do you own it?" value={ownershipStatement} onChangeText={setOwnershipStatement} placeholder="Explain how you own the work or are authorised to act for the owner" multiline />
      <ClaimTextField label="Proof links (one per line)" value={proofLinks} onChangeText={setProofLinks} placeholder="Registration, distributor or release page" autoCapitalize="none" multiline maximumLength={4000}
        errorMessage={areProofLinksValid ? null : "Each line must be a full link starting with https://"} />
      <CopyrightEvidencePicker label="Proof documents" hint="Certificates, contracts or screenshots. Only our copyright team can see them." attachments={proofAttachments} onChange={setProofAttachments} />

      <Text size={14} weight={600} lineHeight={18.2} style={styles.sectionTitle}>Declarations</Text>
      <ClaimCheckbox checked={hasDeclaredGoodFaith} onToggle={() => setHasDeclaredGoodFaith((declared) => !declared)} label={COPYRIGHT_GOOD_FAITH_DECLARATION} />
      <ClaimCheckbox checked={hasDeclaredAccuracy} onToggle={() => setHasDeclaredAccuracy((declared) => !declared)} label={COPYRIGHT_ACCURACY_DECLARATION} />
      <ClaimTextField label="Electronic signature" hint={COPYRIGHT_SIGNATURE_EXPLANATION} value={signatureName} onChangeText={setSignatureName} placeholder={claimantName || "Your full legal name"} maximumLength={160}
        errorMessage={signatureName.length > 0 && !doesSignatureMatch ? "Your signature must match your full legal name" : null} />

      {submitClaim.isError ? (
        <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">
          {submitClaim.error instanceof Error ? submitClaim.error.message : "Couldn't send your claim. Please try again."}
        </Text>
      ) : null}
      <Button title="Submit copyright claim" disabled={!canSubmitClaim} loading={submitClaim.isPending} onPress={() => submitClaim.mutate()} />
    </View>
  );
}

const layout = StyleSheet.create({ root: { gap: 12 } });
