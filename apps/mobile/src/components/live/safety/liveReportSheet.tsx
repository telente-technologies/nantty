import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import { ApiError } from "@/errors/api.error";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { reportsService, type LiveReportReason } from "@/services/reports.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ID } from "@/types";

import {
  LIVE_REPORT_REASON_OPTIONS,
  LIVE_SELF_HARM_SUPPORT_NOTICE,
  LIVE_URGENT_REPORT_NOTICE,
  MAXIMUM_LIVE_REPORT_DETAILS_LENGTH,
  formatLiveReportMoment,
  readLiveReportCooldownRemainingMs,
  rememberLiveReportSent,
} from "./liveReportReasons.constant";

export interface LiveReportTarget {
  readonly liveId: ID;
  readonly liveStartedAt?: string | null;
  readonly subjectLabel?: string;
}

export interface LiveReportSheetProps {
  readonly target: LiveReportTarget | null;
  readonly onClose: () => void;
}

function measureSecondsIntoLive(startedAt: string | null | undefined, reportedAt: Date): number | undefined {
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  return Number.isFinite(started) ? Math.max(0, Math.round((reportedAt.getTime() - started) / 1000)) : undefined;
}

function describeReportError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return "You've sent a lot of reports. Try again in a little while.";
  return error instanceof Error ? error.message : "Couldn't send your report. Please try again.";
}

export function LiveReportSheet({ target, onClose }: LiveReportSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [selectedReason, setSelectedReason] = useState<LiveReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [reportedAt, setReportedAt] = useState(() => new Date());
  const idempotencyKey = useRef(generateIdempotencyKey());
  const offsetSeconds = measureSecondsIntoLive(target?.liveStartedAt, reportedAt);
  const cooldownRemainingMs = target ? readLiveReportCooldownRemainingMs(target.liveId) : 0;

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!target || !selectedReason) return;
      const capturedAt = reportedAt.toISOString();
      await reportsService.submitReportForContent(
        {
          targetType: "live", targetId: target.liveId, reason: selectedReason, details: details.trim(),
          liveContext: { capturedAt, frameRef: `live:${target.liveId}@${capturedAt}`, ...(offsetSeconds === undefined ? {} : { offsetSeconds }) },
        },
        idempotencyKey.current,
      );
      rememberLiveReportSent(target.liveId);
    },
  });

  useEffect(() => {
    if (!target) return;
    setSelectedReason(null);
    setDetails("");
    setReportedAt(new Date());
    idempotencyKey.current = generateIdempotencyKey();
    submitReport.reset();
  }, [target?.liveId]);

  const selectedOption = LIVE_REPORT_REASON_OPTIONS.find((option) => option.reason === selectedReason);
  const isCoolingDown = cooldownRemainingMs > 0 && !submitReport.isSuccess;
  const subject = target?.subjectLabel ?? "this live";

  return (
    <BottomSheet visible={!!target} onClose={onClose} title={submitReport.isSuccess ? "Thanks for letting us know" : `Report ${subject}`}>
      {submitReport.isSuccess ? (
        <View style={styles.body}>
          <Text size={14} lineHeight={19.6} color={colors.textMuted}>
            {selectedOption?.isUrgent ? "Our safety team is reviewing this live now." : "Our safety team will review this live."} We won't tell the host who reported it.
          </Text>
          {selectedReason === "self_harm" ? (
            <View style={styles.notice}>
              <Text size={13} lineHeight={18}>{LIVE_SELF_HARM_SUPPORT_NOTICE}</Text>
            </View>
          ) : null}
          <Button title="Done" onPress={onClose} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text size={14} weight={500} lineHeight={16.8}>What's happening on {subject}?</Text>
          <View accessibilityRole="radiogroup">
            {LIVE_REPORT_REASON_OPTIONS.map((option) => {
              const isSelected = option.reason === selectedReason;
              return (
                <Pressable
                  key={option.reason}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityHint={option.isUrgent ? "Urgent report" : undefined}
                  onPress={() => setSelectedReason(option.reason)}
                  style={styles.reasonRow}
                >
                  <View style={styles.reasonLabel}>
                    <Text size={14} lineHeight={16.8} weight={isSelected ? 600 : 400}>{option.label}</Text>
                    {option.isUrgent ? <Text size={11} weight={600} lineHeight={14} color={colors.error}>Urgent</Text> : null}
                  </View>
                  {isSelected ? <Check16Icon color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
          {selectedReason === "self_harm" ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text size={13} lineHeight={18}>{LIVE_SELF_HARM_SUPPORT_NOTICE}</Text>
            </View>
          ) : selectedOption?.isUrgent ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text size={13} lineHeight={18}>{LIVE_URGENT_REPORT_NOTICE}</Text>
            </View>
          ) : null}
          <TextInput
            value={details}
            onChangeText={(text) => setDetails(text.slice(0, MAXIMUM_LIVE_REPORT_DETAILS_LENGTH))}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textSubtle}
            selectionColor={colors.primary}
            multiline
            maxLength={MAXIMUM_LIVE_REPORT_DETAILS_LENGTH}
            accessibilityLabel="Report details"
            style={styles.detailsInput}
          />
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
            {offsetSeconds === undefined
              ? "We'll attach the moment you reported and a still from the stream."
              : `We'll attach the moment you reported (${formatLiveReportMoment(offsetSeconds)} into the live) and a still from the stream.`}
          </Text>
          {submitReport.isError ? (
            <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">{describeReportError(submitReport.error)}</Text>
          ) : null}
          {isCoolingDown ? (
            <Text size={13} lineHeight={16.9} color={colors.textMuted} accessibilityLiveRegion="polite">
              You reported this live a moment ago. You can send another report in {Math.ceil(cooldownRemainingMs / 1000)} seconds.
            </Text>
          ) : null}
          <Button title="Submit report" disabled={!selectedReason || isCoolingDown} loading={submitReport.isPending} onPress={() => submitReport.mutate()} />
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  reasonRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  reasonLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  notice: { padding: 12, borderRadius: 8, backgroundColor: colors.chip },
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
