import type { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { TextIndent24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { CreateMode } from "@/types";

import { CameraBackdrop } from "./cameraBackdrop";
import { CreateModePill } from "./createModePill";
import { RecordButton } from "./recordButton";

export interface LiveSetupPanelProps {
  readonly title: string;
  readonly onChangeTitle: (title: string) => void;
  readonly isEditingTitle: boolean;
  readonly onStartEditingTitle: () => void;
  readonly onFinishEditingTitle: () => void;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly starting: boolean;
  readonly onGoLive: () => void;
}

export function LiveSetupPanel(props: LiveSetupPanelProps) {
  const cameraRef = useRef<CameraView>(null);
  const [draftTitle, setDraftTitle] = useState(props.title);
  const { canGoLive } = useCreatorStatus();

  return (
    <View style={styles.flex}>
      <CameraBackdrop ref={cameraRef} active />
      {props.isEditingTitle ? (
        <View style={styles.dim}>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Title..."
            placeholderTextColor={colors.placeholder}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            autoFocus
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={() => {
              props.onChangeTitle(draftTitle.trim());
              props.onFinishEditingTitle();
            }}
            onBlur={() => {
              props.onChangeTitle(draftTitle.trim());
              props.onFinishEditingTitle();
            }}
            accessibilityLabel="Live title"
            style={styles.titleInput}
          />
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.title ? `Edit live title, ${props.title}` : "Add a live title"}
            onPress={() => {
              setDraftTitle(props.title);
              props.onStartEditingTitle();
            }}
            style={[styles.titleChip, props.title ? styles.titleChipFilled : null]}
          >
            <TextIndent24Icon />
            <Text size={13} weight={500} lineHeight={16.9} numberOfLines={1}>
              {props.title || "Title"}
            </Text>
          </Pressable>
          <View style={styles.bottom} pointerEvents="box-none">
            {props.title ? null : <CreateModePill mode="live" onChangeMode={props.onChangeMode} />}
            <RecordButton label="Go live" disabled={props.starting || !canGoLive} onPress={props.onGoLive} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 16, paddingTop: 20 },
  titleInput: {
    padding: 0,
    fontFamily: fontFamily[400],
    fontSize: 21,
    lineHeight: 25.2,
    letterSpacing: calculateDefaultLetterSpacing(21),
    color: colors.placeholder,
  },
  titleChip: { position: "absolute", top: 20, left: 16, flexDirection: "row", alignItems: "center", gap: 24, maxWidth: 300 },
  titleChipFilled: { top: 7, padding: 8, gap: 12, borderRadius: 4, backgroundColor: "#8F8F8F" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 20, gap: 19, alignItems: "center" },
});
