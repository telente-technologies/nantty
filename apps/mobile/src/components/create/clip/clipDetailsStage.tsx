import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ID } from "@/types";
import type { MentionEntity } from "@/types/mention.type";

import { useCaptionField } from "../captionField.hook";
import { DismissKeyboardScrollView } from "../dismissKeyboardScrollView";
import { KeyboardDoneBar } from "../keyboardDoneBar";
import { SoundPickerRow } from "../soundPickerRow";

export interface ClipDetailsStageProps {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly onChangeCaption: (text: string, mentions: readonly MentionEntity[]) => void;
  readonly coverUri: string | null;
  readonly lengthLabel: string;
  readonly hasOwnAudio: boolean;
  readonly selectedSoundId: ID | null;
  readonly onChangeSelectedSoundId: (soundId: ID | null) => void;
}

export function ClipDetailsStage(props: ClipDetailsStageProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const caption = useCaptionField({ text: props.text, mentions: props.mentions, onChange: props.onChangeCaption, placeholder: "Write a caption…", minHeight: 96 });
  return (
    <View style={styles.flex}>
      <DismissKeyboardScrollView contentContainerStyle={styles.content}>
        <View style={styles.captionRow}>
          <View style={styles.flex}>{caption.input}</View>
          {props.coverUri ? (
            <View style={styles.cover}>
              <Image source={{ uri: props.coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Clip cover" />
              <View style={styles.length}><Text size={11} weight={600} lineHeight={14} color={colors.white}>{props.lengthLabel}</Text></View>
            </View>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text size={13} weight={600} lineHeight={16.9} color={colors.textMuted} accessibilityRole="header">Sound</Text>
          <SoundPickerRow selectedSoundId={props.selectedSoundId} onChangeSelectedSoundId={props.onChangeSelectedSoundId} hasOwnAudio={props.hasOwnAudio} />
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {props.hasOwnAudio ? "Keep your clip's own audio or pick a sound from the library." : "Photo clips have no audio of their own. Pick a sound to play over them."}
          </Text>
        </View>
      </DismissKeyboardScrollView>
      {caption.suggestions}
      <KeyboardDoneBar visible={caption.focused} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 24 },
  captionRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cover: { width: 72, height: 128, borderRadius: 8, overflow: "hidden", backgroundColor: colors.media },
  length: { position: "absolute", right: 4, bottom: 4, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.overlay },
  section: { gap: 8 },
}));
