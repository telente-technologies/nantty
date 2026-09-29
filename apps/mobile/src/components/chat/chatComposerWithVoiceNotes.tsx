import { Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, PaperPlaneTilt24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LocalMediaFile } from "@/services/mediaPreparation.service";

import { MessageComposerBar } from "./messageComposerBar";
import { formatVoiceNoteDuration, useVoiceNoteRecorder } from "./voiceNoteRecorder.hook";

export interface ChatComposerWithVoiceNotesProps {
  readonly onSendText: (text: string) => void;
  readonly onSendVoiceNote: (voiceNote: LocalMediaFile) => void;
  readonly onTypingChange?: (isTyping: boolean) => void;
}

export function ChatComposerWithVoiceNotes({ onSendText, onSendVoiceNote, onTypingChange }: ChatComposerWithVoiceNotesProps) {
  const voiceRecorder = useVoiceNoteRecorder(onSendVoiceNote);

  if (!voiceRecorder.isRecording) {
    return (
      <MessageComposerBar
        onSend={onSendText}
        onTypingChange={onTypingChange}
        onPressMicrophone={voiceRecorder.isPreparing ? undefined : () => voiceRecorder.startRecordingVoiceNote()}
      />
    );
  }

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel voice note" hitSlop={10} onPress={() => voiceRecorder.stopRecordingAndDiscard()}>
        <Cancel20Icon />
      </Pressable>
      <View style={styles.status}>
        <View style={styles.recordingDot} />
        <Text size={14} weight={500} lineHeight={16.8}>
          Recording {formatVoiceNoteDuration(voiceRecorder.recordedSeconds)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Send voice note" hitSlop={10} onPress={() => voiceRecorder.stopRecordingAndSend()}>
        <PaperPlaneTilt24Icon color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 60,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  status: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
});
