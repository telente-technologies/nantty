import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { isCopyrightClaimTargetType } from "@/services/moderation/copyrightClaims.service";
import {
  MAXIMUM_REPORT_DETAILS_LENGTH,
  REPORT_REASON_OPTIONS,
  reportsService,
  type ReportReason,
  type ReportTargetType,
} from "@/services/moderation/reports.service";
import type { ID } from "@/types";

import { CopyrightClaimForm } from "./copyrightClaimForm";

export interface ReportTarget {
  readonly targetType: ReportTargetType;
  readonly targetId: ID;
  readonly initialReason?: ReportReason;
}

export interface ReportSheetProps {
  readonly target: ReportTarget | null;
  readonly onClose: () => void;
}

const describeReportTarget = (targetType: ReportTargetType) =>
  ({ post: "post", clip: "clip", comment: "comment", live: "live", space: "Space", user: "account", product: "product", message: "message", sound: "sound" })[targetType];

export function ReportSheet({ target, onClose }: ReportSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const idempotencyKeyForThisReport = useRef(generateIdempotencyKey());

  const submitReport = useMutation({
    mutationFn: () =>
      reportsService.submitReportForContent(
        {
          targetType: target!.targetType,
          targetId: target!.targetId,
          ...(target!.targetType === "user" ? { reportedUserId: target!.targetId } : {}),
          reason: selectedReason!,
          details: details.trim(),
        },
        idempotencyKeyForThisReport.current,
      ),
  });

  useEffect(() => {
    if (!target) return;
    setSelectedReason(target.initialReason ?? null);
    setDetails("");
    setHasSubmittedCopyrightClaim(false);
    idempotencyKeyForThisReport.current = generateIdempotencyKey();
    submitReport.reset();
  }, [target?.targetType, target?.targetId, target?.initialReason]);

  const targetName = target ? describeReportTarget(target.targetType) : "content";
  const [hasSubmittedCopyrightClaim, setHasSubmittedCopyrightClaim] = useState(false);
  const isShowingCopyrightClaimForm =
    selectedReason === "intellectual_property" && !!target && isCopyrightClaimTargetType(target.targetType);
  const hasFinishedReporting = submitReport.isSuccess || hasSubmittedCopyrightClaim;

  return (
    <BottomSheet visible={!!target} onClose={onClose} title={hasFinishedReporting ? "Thanks for letting us know" : `Report ${targetName}`} scrollable>
      {hasFinishedReporting ? (
        <View style={styles.body}>
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>
            {hasSubmittedCopyrightClaim
              ? `Our copyright team will review your claim and contact you by email. The ${targetName} may be restricted while it's under review.`
              : `Our safety team will review this ${targetName}. We won't tell the person who reported it.`}
          </Text>
          <Button title="Done" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.body}>
          <Text size={14} weight={500} lineHeight={16.8}>
            Why are you reporting this {targetName}?
          </Text>
          <View accessibilityRole="radiogroup">
            {REPORT_REASON_OPTIONS.map((option) => {
              const isSelected = option.reason === selectedReason;
              return (
                <Pressable
                  key={option.reason}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => setSelectedReason(option.reason)}
                  style={styles.reasonRow}
                >
                  <Text size={14} lineHeight={16.8} weight={isSelected ? 600 : 400}>
                    {option.label}
                  </Text>
                  {isSelected ? <Check16Icon color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
          {isShowingCopyrightClaimForm && target && isCopyrightClaimTargetType(target.targetType) ? (
            <CopyrightClaimForm
              targetType={target.targetType}
              targetId={target.targetId}
              onSubmitted={() => setHasSubmittedCopyrightClaim(true)}
            />
          ) : null}
          {isShowingCopyrightClaimForm ? null : (
          <TextInput
            value={details}
            onChangeText={(text) => setDetails(text.slice(0, MAXIMUM_REPORT_DETAILS_LENGTH))}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textSubtle}
            selectionColor={colors.primary}
            multiline
            maxLength={MAXIMUM_REPORT_DETAILS_LENGTH}
            accessibilityLabel="Report details"
            style={styles.detailsInput}
          />
          )}
          {isShowingCopyrightClaimForm ? null : (
            <Text size={12} lineHeight={16.8} color={colors.textSubtle} align="right">
              {details.length}/{MAXIMUM_REPORT_DETAILS_LENGTH}
            </Text>
          )}
          {submitReport.isError ? (
            <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">
              {submitReport.error instanceof Error ? submitReport.error.message : "Couldn't send your report. Please try again."}
            </Text>
          ) : null}
          {isShowingCopyrightClaimForm ? null : (
            <Button title="Submit report" disabled={!selectedReason} loading={submitReport.isPending} onPress={() => submitReport.mutate()} />
          )}
        </View>
      )}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingBottom: 8, gap: 12 },
  reasonRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailsInput: {
    minHeight: 88,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
}));
