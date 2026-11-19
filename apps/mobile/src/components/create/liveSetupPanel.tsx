import type { CameraView } from "expo-camera";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";

import { ArrowsOutSimple24Icon, TextIndent24Icon, VideoCamera24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { dismissKeyboardOnEmptyTap } from "@/components/ui/dismissKeyboardOnEmptyTap.util";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { CreateMode, LiveCategory, LiveSource } from "@/types";

import { LiveMonetizationSheet } from "./liveMonetizationSheet";
import { isLiveAdAcceptanceInEffect, type LiveMonetizationDraft } from "./liveMonetization.constant";
import { LIVE_CATEGORIES, LIVE_SOURCE_ICON, LIVE_SOURCES } from "./liveSetupOptions.constant";
import { CameraBackdrop } from "./cameraBackdrop";
import { CreateModePill } from "./createModePill";
import { RecordButton } from "./recordButton";

export interface LiveStreamCredentials {
  readonly liveId: string;
  readonly ingestUrl: string;
  readonly streamKey: string;
}

export interface LiveSetupPanelProps {
  readonly title: string;
  readonly onChangeTitle: (title: string) => void;
  readonly isEditingTitle: boolean;
  readonly onStartEditingTitle: () => void;
  readonly onFinishEditingTitle: () => void;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly category: LiveCategory;
  readonly onChangeCategory: (category: LiveCategory) => void;
  readonly canSell: boolean;
  readonly source: LiveSource;
  readonly onChangeSource: (source: LiveSource) => void;
  readonly credentials: LiveStreamCredentials | null;
  readonly onOpenLiveRoom: (liveId: string) => void;
  readonly starting: boolean;
  readonly onGoLive: () => void;
  readonly monetization: LiveMonetizationDraft;
  readonly onChangeMonetization: (draft: LiveMonetizationDraft) => void;
}

export function LiveSetupPanel(props: LiveSetupPanelProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const cameraRef = useRef<CameraView>(null);
  const [draftTitle, setDraftTitle] = useState(props.title);
  const [isMonetizationOpen, setIsMonetizationOpen] = useState(false);
  const { canGoLive } = useCreatorStatus();
  const credentials = props.credentials;

  function shareCredentials() {
    if (!credentials) return;
    void Share.share({
      message: `Go live on Nantty\n\nServer URL: ${credentials.ingestUrl}\nStream key: ${credentials.streamKey}`,
    });
  }

  return (
    <View style={styles.flex}>
      {props.source === "camera" ? (
        <CameraBackdrop ref={cameraRef} active />
      ) : (
        <View style={styles.stage}>
          {props.source === "screen" ? (
            <View style={styles.stageBody}>
              <ArrowsOutSimple24Icon size={36} color={colors.white} />
              <Text size={15} weight={600} lineHeight={20} color={colors.white} align="center">
                Your screen goes live
              </Text>
              <Text size={13} lineHeight={18} color={colors.white} align="center">
                Play, show an app or demo anything on this phone — the camera stays off.
              </Text>
            </View>
          ) : (
            <View style={styles.stageBody}>
              {credentials ? (
                <>
                  <Text size={13} lineHeight={17} color={colors.white} align="center">
                    Paste these into OBS or any encoder.
                  </Text>
                  <View style={styles.credentialCard}>
                    <Text size={11} lineHeight={14} color={colors.textMuted}>
                      SERVER URL
                    </Text>
                    <Text size={13} lineHeight={17} weight={600} color={colors.text}>
                      {credentials.ingestUrl}
                    </Text>
                    <View style={styles.credentialDivider} />
                    <Text size={11} lineHeight={14} color={colors.textMuted}>
                      STREAM KEY
                    </Text>
                    <Text size={13} lineHeight={17} weight={600} color={colors.text}>
                      {credentials.streamKey}
                    </Text>
                  </View>
                  <Button title="Share server & key" variant="subtle" onPress={shareCredentials} style={styles.shareButton} />
                  <Text size={11} lineHeight={14} color={colors.white} align="center">
                    Waiting for your encoder to connect.
                  </Text>
                </>
              ) : (
                <>
                  <VideoCamera24Icon size={36} color={colors.white} />
                  <Text size={15} weight={600} lineHeight={20} color={colors.white} align="center">
                    Stream from OBS or any encoder
                  </Text>
                  <Text size={13} lineHeight={18} color={colors.white} align="center">
                    Go live to get a server URL and stream key for this session.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {props.isEditingTitle ? (
        <View style={styles.dim} onStartShouldSetResponder={dismissKeyboardOnEmptyTap}>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Title..."
            placeholderTextColor={colors.inputPlaceholderText}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow} accessibilityRole="radiogroup">
              {LIVE_CATEGORIES.filter((item) => item.category !== "shopping" || props.canSell).map((item) => {
                const selected = props.category === item.category;
                return (
                  <Pressable
                    key={item.category}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${item.label} category`}
                    onPress={() => props.onChangeCategory(item.category)}
                    style={[styles.categoryChip, selected ? styles.sourceItemSelected : null]}
                  >
                    <Text size={12} weight={selected ? 600 : 500} lineHeight={15.6} color={selected ? colors.black : colors.white}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.sourcePicker} accessibilityRole="tablist">
              {LIVE_SOURCES.map((item) => {
                const Icon = LIVE_SOURCE_ICON[item.source];
                const selected = props.source === item.source;
                return (
                  <Pressable
                    key={item.source}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item.label} source`}
                    onPress={() => props.onChangeSource(item.source)}
                    style={[styles.sourceItem, selected ? styles.sourceItemSelected : null]}
                  >
                    <Icon size={16} color={selected ? colors.black : colors.white} />
                    <Text size={12} weight={selected ? 600 : 500} lineHeight={15.6} color={selected ? colors.black : colors.white}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Live monetization settings"
              onPress={() => setIsMonetizationOpen(true)}
              style={styles.categoryChip}
            >
              <Text size={12} weight={500} lineHeight={15.6} color={colors.white}>
                Live monetization · {isLiveAdAcceptanceInEffect(props.monetization) ? "Ads on" : "Ads off"}
              </Text>
            </Pressable>
            {props.title ? null : <CreateModePill mode="live" onChangeMode={props.onChangeMode} />}
            {credentials ? (
              <Button title="Open live room" onPress={() => credentials && props.onOpenLiveRoom(credentials.liveId)} style={styles.openRoomButton} />
            ) : (
              <RecordButton label="Go live" disabled={props.starting || !canGoLive} onPress={props.onGoLive} />
            )}
          </View>
        </>
      )}
      <LiveMonetizationSheet
        visible={isMonetizationOpen}
        onClose={() => setIsMonetizationOpen(false)}
        draft={props.monetization}
        onChangeDraft={props.onChangeMonetization}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  stage: { ...StyleSheet.absoluteFill, backgroundColor: "#101018", alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  stageBody: { alignItems: "center", gap: 12, maxWidth: 320 },
  credentialCard: {
    width: "100%",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  credentialDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 6 },
  shareButton: { width: 200 },
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
  sourcePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16,16,24,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  sourceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  sourceItemSelected: { backgroundColor: colors.surface },
  categoryRow: { gap: 8, paddingHorizontal: 16 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(16,16,24,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
  },
  openRoomButton: { width: 200 },
}));
