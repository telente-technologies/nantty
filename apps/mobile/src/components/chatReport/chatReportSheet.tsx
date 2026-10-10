import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { syncConversationMessagesIncrementallyAndReadLocalHistory } from "@/cache/messageSync.util";
import { Flag24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import type { ModalAction } from "@/components/ui/modalActions";
import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { makeThemedStyles, useTheme } from "@/theme";

import { useChatReportDraft } from "./chatReportDraft.hook";
import { ChatReportDoneStep } from "./chatReportDoneStep";
import { ChatReportEvidenceStep } from "./chatReportEvidenceStep";
import { ChatReportReasonStep } from "./chatReportReasonStep";
import { useChatReportSubmission } from "./chatReportSubmission.hook";
import { describeChatReportTarget, doesChatReportTargetCarryEvidence, type ChatReportTarget } from "./chatReportTarget.type";

export interface ChatReportSheetProps {
  readonly target: ChatReportTarget | null;
  readonly onClose: () => void;
}

export function ChatReportSheet({ target, onClose }: ChatReportSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const draft = useChatReportDraft(target);
  const carriesEvidence = !!target && doesChatReportTargetCarryEvidence(target);
  const messages = useQuery({
    queryKey: ["messages", target?.conversationId],
    queryFn: () => syncConversationMessagesIncrementallyAndReadLocalHistory(target!.conversationId),
    enabled: carriesEvidence,
  });
  const { submission, resetSubmission, selectedEvidenceCount } = useChatReportSubmission(target, draft, messages.data ?? []);

  const isOtherReasonMissingText = draft.reason === "other" && draft.details.trim().length === 0;
  const canContinue = !!draft.reason && !isOtherReasonMissingText;
  const closeAndReset = () => {
    onClose();
    resetSubmission();
  };
  const title = draft.step === "done" ? "Report sent" : target ? `Report ${describeChatReportTarget(target)}` : "Report";
  const submitReport = () => submission.mutate();

  const footerActions: ModalAction[] = !target || draft.step === "done"
    ? []
    : draft.step === "reason" && carriesEvidence
      ? [{ label: "Next", style: "primary", disabled: !canContinue, onPress: () => draft.setStep("evidence") }]
      : draft.step === "reason"
        ? [{ label: target.alsoBlock ? "Report and block" : "Submit report", style: target.alsoBlock ? "destructive" : "primary", disabled: !canContinue, loading: submission.isPending, onPress: submitReport }]
        : [
            { label: target.alsoBlock ? "Send and block" : "Send report", style: target.alsoBlock ? "destructive" : "primary", disabled: selectedEvidenceCount === 0 || messages.isLoading, loading: submission.isPending, onPress: submitReport },
            { label: "Back", style: "secondary", onPress: () => draft.setStep("reason") },
          ];

  return (
    <BottomSheet visible={!!target} onClose={closeAndReset} title={title} scrollable footerActions={footerActions}>
      {target ? (
        draft.step === "done" ? (
          <View style={styles.body}>
            <ChatReportDoneStep
              target={target}
              isUrgent={draft.reason === "child_safety"}
              onClose={closeAndReset}
              onOpenMyReports={() => {
                closeAndReset();
                navigation.navigate("MyReports");
              }}
            />
          </View>
        ) : (
          <View style={styles.body}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
              <Flag24Icon size={22} color={colors.error} />
            </View>
            {draft.step === "reason" ? (
              <>
                <Text size={14} weight={500} lineHeight={18} color={colors.textMuted}>Why are you reporting this?</Text>
                <ChatReportReasonStep reason={draft.reason} details={draft.details} onChangeReason={draft.setReason} onChangeDetails={draft.setDetails} />
              </>
            ) : (
              <ChatReportEvidenceStep draft={draft} messages={messages.data ?? []} selectedEvidenceCount={selectedEvidenceCount} />
            )}
            {submission.isError ? (
              <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert">
                {submission.error instanceof Error ? submission.error.message : "Couldn't send your report. Please try again."}
              </Text>
            ) : null}
          </View>
        )
      ) : null}
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({
  body: { paddingTop: 4, gap: 12 },
}));
