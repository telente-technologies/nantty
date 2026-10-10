import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { MapPin24Icon, Users24Icon } from "@/components/icons";
import { MentionText } from "@/components/mentions/mentionText";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MentionEntity } from "@/types/mention.type";

import { AiGeneratedToggleRow } from "../aiGeneratedToggleRow";
import { PostAudienceSettings } from "../postAudienceSettings";
import { PostAsIdentityRow } from "../postAsIdentityRow";
import { PlaceSearchSheet } from "./placeSearchSheet";
import type { PostSettingsValue } from "./postSettings.type";
import { SettingsLinkRow } from "./settingsLinkRow";
import { TagPeopleSheet } from "./tagPeopleSheet";

export interface PostSettingsStepProps {
  readonly value: PostSettingsValue;
  readonly onChange: (value: PostSettingsValue) => void;
  readonly caption: string;
  readonly mentions: readonly MentionEntity[];
  readonly thumbnailUri: string | null;
  readonly mediaSummary: string | null;
  readonly preview?: ReactNode;
  readonly publishing: boolean;
  readonly publishButtonTitle: string;
  readonly publishErrorMessage: string | null;
  readonly onPublish: () => void;
  readonly onSaveDraft?: () => void;
}

const describeTagged = (value: PostSettingsValue) => {
  if (value.tagged.length === 0) return null;
  const [first, second] = value.tagged;
  if (value.tagged.length === 1) return `@${first!.username}`;
  if (value.tagged.length === 2) return `@${first!.username} and @${second!.username}`;
  return `@${first!.username} and ${value.tagged.length - 1} others`;
};

export function PostSettingsStep(props: PostSettingsStepProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { value, onChange } = props;
  const [openSheet, setOpenSheet] = useState<"tags" | "location" | null>(null);
  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <PostAsIdentityRow />
        {props.preview ?? (
          <View style={styles.summary}>
            {props.thumbnailUri ? <Image source={{ uri: props.thumbnailUri }} style={styles.thumbnail} contentFit="cover" accessibilityLabel={props.mediaSummary ?? "Media"} /> : null}
            <View style={styles.flex}>
              {props.caption ? (
                <MentionText text={props.caption} mentions={props.mentions} size={14} lineHeight={19.6} numberOfLines={4} />
              ) : (
                <Text size={14} lineHeight={19.6} color={colors.textMuted}>No caption</Text>
              )}
              {props.mediaSummary ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>{props.mediaSummary}</Text> : null}
            </View>
          </View>
        )}
        <View>
          <SettingsLinkRow icon={<Users24Icon size={22} />} label="Tag people" value={describeTagged(value)} hint="Search for people to tag in this post" onPress={() => setOpenSheet("tags")} />
          <SettingsLinkRow
            icon={<MapPin24Icon size={22} />}
            label="Add location"
            value={value.location ? [value.location.name, value.location.area].filter(Boolean).join(", ") : null}
            hint="Search for a place to show on this post"
            onPress={() => setOpenSheet("location")}
          />
        </View>
        <View style={styles.section}>
          <Text size={13} weight={600} lineHeight={16.9} color={colors.textMuted} accessibilityRole="header">Advanced settings</Text>
          <PostAudienceSettings value={value.audienceSettings} onChange={(audienceSettings) => onChange({ ...value, audienceSettings })} />
          <AiGeneratedToggleRow value={value.isAiGenerated} onChange={(isAiGenerated) => onChange({ ...value, isAiGenerated })} />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {props.publishErrorMessage ? (
          <Text size={13} lineHeight={16.9} color={colors.error} accessibilityLiveRegion="polite">{props.publishErrorMessage}</Text>
        ) : null}
        <Button title={props.publishButtonTitle} disabled={props.publishing} loading={props.publishing} onPress={props.onPublish} />
        {props.onSaveDraft ? (
          <Button variant="subtle" title="Save as draft" disabled={props.publishing} onPress={props.onSaveDraft} />
        ) : null}
      </View>
      <TagPeopleSheet visible={openSheet === "tags"} tagged={value.tagged} onChange={(tagged) => onChange({ ...value, tagged })} onClose={() => setOpenSheet(null)} />
      <PlaceSearchSheet
        visible={openSheet === "location"}
        selected={value.location}
        onSelect={(location) => {
          onChange({ ...value, location });
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 20 },
  summary: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  thumbnail: { width: 64, height: 80, borderRadius: 8, backgroundColor: colors.placeholder },
  section: { gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.divider },
}));
