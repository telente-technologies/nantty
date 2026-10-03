import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import {
  copyrightClaimsService,
  isValidContactEmailAddress,
  MAXIMUM_COPYRIGHT_TEXT_LENGTH,
} from "@/services/copyrightClaims.service";
import type { CopyrightClaimTargetType, ID } from "@/types";

export interface CopyrightClaimFormProps {
  readonly targetType: CopyrightClaimTargetType;
  readonly targetId: ID;
  readonly onSubmitted: () => void;
}

const describeClaimedContent = (targetType: CopyrightClaimTargetType, targetId: ID) =>
  `${{ clip: "Clip", sound: "Sound", post: "Post", live: "Live video" }[targetType]} · ${targetId}`;

export function CopyrightClaimForm({ targetType, targetId, onSubmitted }: CopyrightClaimFormProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [workDescription, setWorkDescription] = useState("");
  const [ownershipStatement, setOwnershipStatement] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hasDeclaredGoodFaith, setHasDeclaredGoodFaith] = useState(false);
  const idempotencyKeyForThisClaim = useRef(generateIdempotencyKey());

  const isContactEmailValid = isValidContactEmailAddress(contactEmail);
  const canSubmitClaim =
    workDescription.trim().length >= 10 && ownershipStatement.trim().length >= 10 && isContactEmailValid && hasDeclaredGoodFaith;

  const submitClaim = useMutation({
    mutationFn: () =>
      copyrightClaimsService.submitCopyrightClaim(
        {
          targetType,
          targetId,
          workDescription: workDescription.trim(),
          ownershipStatement: ownershipStatement.trim(),
          contactEmail: contactEmail.trim(),
          goodFaith: true,
        },
        idempotencyKeyForThisClaim.current,
      ),
    onSuccess: onSubmitted,
  });

  return (
    <View style={styles.root}>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Content being claimed: {describeClaimedContent(targetType, targetId)}
      </Text>
      <LabelledTextArea
        label="Describe your copyrighted work"
        placeholder="e.g. my song “Owambe Nights”, released 2024"
        value={workDescription}
        onChangeText={setWorkDescription}
      />
      <LabelledTextArea
        label="Your ownership statement"
        placeholder="Explain how you own or are authorised to act for the owner"
        value={ownershipStatement}
        onChangeText={setOwnershipStatement}
      />
      <View style={styles.field}>
        <Text size={13} weight={500} lineHeight={16.9}>
          Contact email
        </Text>
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Contact email"
          style={[styles.input, contactEmail.length > 0 && !isContactEmailValid ? styles.invalidInput : null]}
        />
        {contactEmail.length > 0 && !isContactEmailValid ? (
          <Text size={12} lineHeight={16.8} color={colors.error}>
            Enter a valid email address
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasDeclaredGoodFaith }}
        onPress={() => setHasDeclaredGoodFaith((declared) => !declared)}
        style={styles.declarationRow}
      >
        <View style={[styles.checkbox, hasDeclaredGoodFaith ? styles.checkboxChecked : null]}>
          {hasDeclaredGoodFaith ? <Check16Icon color={colors.white} /> : null}
        </View>
        <Text size={13} lineHeight={18.2} style={styles.declarationText}>
          I declare in good faith that this use is not authorised by the copyright owner, its agent or the law, and that the information
          in this claim is accurate.
        </Text>
      </Pressable>
      {submitClaim.isError ? (
        <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">
          {submitClaim.error instanceof Error ? submitClaim.error.message : "Couldn't send your claim. Please try again."}
        </Text>
      ) : null}
      <Button title="Submit copyright claim" disabled={!canSubmitClaim} loading={submitClaim.isPending} onPress={() => submitClaim.mutate()} />
    </View>
  );
}

function LabelledTextArea(props: { label: string; placeholder: string; value: string; onChangeText: (text: string) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text size={13} weight={500} lineHeight={16.9}>
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={(text) => props.onChangeText(text.slice(0, MAXIMUM_COPYRIGHT_TEXT_LENGTH))}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        multiline
        maxLength={MAXIMUM_COPYRIGHT_TEXT_LENGTH}
        accessibilityLabel={props.label}
        style={[styles.input, styles.multilineInput]}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 12 },
  field: { gap: 6 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top" },
  invalidInput: { borderColor: colors.error },
  declarationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primarySolid, borderColor: colors.primary },
  declarationText: { flex: 1 },
}));
