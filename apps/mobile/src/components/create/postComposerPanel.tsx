import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { CreateMode, Media, NewPostInput, PostAudience } from "@/types";

import { CreateModePill } from "./createModePill";
import { pickPhotosAndVideosFromLibrary, takePhotoWithSystemCamera } from "./pickMedia.util";
import { PostToolbar } from "./postToolbar";

export interface PostComposerPanelProps {
  readonly stage: "compose" | "preview";
  readonly draft: NewPostInput;
  readonly onChangeDraft: (draft: NewPostInput) => void;
  readonly onChangeMode: (mode: CreateMode) => void;
  readonly publishing: boolean;
  readonly onPublish: () => void;
}

export function PostComposerPanel({ stage, draft, onChangeDraft, onChangeMode, publishing, onPublish }: PostComposerPanelProps) {
  const [focused, setFocused] = useState(false);
  const addMediaToDraft = (media: Media[]) => onChangeDraft({ ...draft, media: [...draft.media, ...media].slice(0, 10) });
  const toggleAudience = () => onChangeDraft({ ...draft, audience: draft.audience === "everyone" ? ("followers" as PostAudience) : "everyone" });

  if (stage === "preview") {
    return (
      <ScrollView contentContainerStyle={styles.preview}>
        {draft.text ? (
          <Text size={14} lineHeight={16.8}>
            {draft.text}
          </Text>
        ) : null}
        {draft.media[0] ? (
          <View style={styles.previewMedia}>
            {draft.media[0].url ? <Image source={{ uri: draft.media[0].url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
        ) : null}
        <Button title="Post" loading={publishing} onPress={onPublish} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.compose} keyboardShouldPersistTaps="handled">
        <TextInput
          value={draft.text}
          onChangeText={(text) => onChangeDraft({ ...draft, text })}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What’s happening?"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          multiline
          autoFocus
          maxLength={2000}
          accessibilityLabel="What’s happening?"
          style={styles.input}
        />
        {draft.media.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {draft.media.map((m, i) => (
              <View key={`${m.url}-${i}`} style={styles.thumb}>
                {m.url ? <Image source={{ uri: m.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>
      {focused ? null : (
        <View style={styles.pill}>
          <CreateModePill mode="post" onChangeMode={onChangeMode} />
        </View>
      )}
      <PostToolbar
        audience={draft.audience}
        onToggleAudience={toggleAudience}
        onTakePhoto={async () => addMediaToDraft(await takePhotoWithSystemCamera())}
        onPickFromLibrary={async () => addMediaToDraft(await pickPhotosAndVideosFromLibrary(true))}
        onEditMedia={async () => addMediaToDraft(await pickPhotosAndVideosFromLibrary(false))}
        onAddLocation={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compose: { paddingHorizontal: 16, paddingTop: 32, gap: 16 },
  input: {
    minHeight: 120,
    padding: 0,
    textAlignVertical: "top",
    fontFamily: fontFamily[400],
    fontSize: 16,
    lineHeight: 19.2,
    letterSpacing: calculateDefaultLetterSpacing(16),
    color: colors.text,
  },
  thumbs: { gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden" },
  pill: { paddingBottom: 29 },
  preview: { paddingHorizontal: 16, paddingTop: 20, gap: 24, paddingBottom: 40 },
  previewMedia: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden" },
});
