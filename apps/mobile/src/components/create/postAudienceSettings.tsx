import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { At24Icon, BellSlash24Icon, ChatTeardropText24Icon, EyeSlash24Icon, GlobeHemisphereWest24Icon, LockSimple24Icon, UserPlus24Icon, Users24Icon } from "@/components/icons";
import { ActionSheet } from "@/components/ui/actionSheet";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { replyPolicyLabel, replyPolicyOptions, sensitiveLabelOptions } from "@/constants/postAudienceCopy.constant";
import { useContentPreferences } from "@/hooks/useContentPreferences.hook";
import { useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import { useTheme } from "@/theme";
import type { ReplyPolicy, SensitiveLabel } from "@/types/postAudience.type";

export interface PostAudienceSettingsValue {
  readonly replyPolicy: ReplyPolicy;
  readonly visibility: "public" | "subscribers";
  readonly sensitiveLabels: readonly SensitiveLabel[];
}

export interface PostAudienceSettingsProps {
  readonly value: PostAudienceSettingsValue;
  readonly onChange: (value: PostAudienceSettingsValue) => void;
}

export function PostAudienceSettings({ value, onChange }: PostAudienceSettingsProps) {
  const { colors } = useTheme();
  const [isReplyPickerOpen, setIsReplyPickerOpen] = useState(false);
  const [isMarkedSensitive, setIsMarkedSensitive] = useState(value.sensitiveLabels.length > 0);
  const { isApprovedCreator } = useCreatorStatus();
  const { isAdult } = useContentPreferences();
  const availableLabels = sensitiveLabelOptions.filter((option) => isAdult || !option.adultsOnly);
  const toggleLabel = (label: SensitiveLabel) =>
    onChange({ ...value, sensitiveLabels: value.sensitiveLabels.includes(label) ? value.sensitiveLabels.filter((item) => item !== label) : [...value.sensitiveLabels, label] });

  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Who can reply, ${replyPolicyLabel(value.replyPolicy)}`} accessibilityHint="Choose who can reply to this post" onPress={() => setIsReplyPickerOpen(true)} style={styles.row}>
        <ChatTeardropText24Icon size={20} color={colors.textMuted} />
        <View style={styles.texts}>
          <Text size={14} weight={500} lineHeight={16.8}>Who can reply</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{replyPolicyOptions.find((option) => option.value === value.replyPolicy)?.detail}</Text>
        </View>
        <Text size={14} weight={500} lineHeight={16.8} color={colors.primary}>{replyPolicyLabel(value.replyPolicy)}</Text>
      </Pressable>
      {isApprovedCreator ? (
        <View style={styles.row}>
          <LockSimple24Icon size={20} color={colors.textMuted} />
          <View style={styles.texts}>
            <Text size={14} weight={500} lineHeight={16.8}>Subscribers only</Text>
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>Only your subscribers can see this post. Others see a locked preview with a Subscribe button.</Text>
          </View>
          <Switch
            value={value.visibility === "subscribers"}
            onValueChange={(isOn) => onChange({ ...value, visibility: isOn ? "subscribers" : "public" })}
            accessibilityLabel="Subscribers only"
            trackColor={{ true: colors.primary, false: colors.divider }}
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <EyeSlash24Icon size={20} color={colors.textMuted} />
        <View style={styles.texts}>
          <Text size={14} weight={500} lineHeight={16.8}>Mark as sensitive</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Viewers see a warning first and choose whether to view. Under-18s never see adult categories.</Text>
        </View>
        <Switch
          value={isMarkedSensitive}
          onValueChange={(isOn) => {
            setIsMarkedSensitive(isOn);
            if (!isOn) onChange({ ...value, sensitiveLabels: [] });
          }}
          accessibilityLabel="Mark as sensitive"
          trackColor={{ true: colors.primary, false: colors.divider }}
        />
      </View>
      {isMarkedSensitive ? (
        <View style={styles.chips} accessibilityLabel="What could viewers find sensitive?">
          {availableLabels.map((option) => (
            <Chip key={option.value} kind="filter" label={option.label} selected={value.sensitiveLabels.includes(option.value)} onPress={() => toggleLabel(option.value)} />
          ))}
          {value.sensitiveLabels.length === 0 ? (
            <Text size={12} lineHeight={16.8} color={colors.cautionText}>Pick at least one so viewers know what to expect.</Text>
          ) : null}
        </View>
      ) : null}
      <ActionSheet
        visible={isReplyPickerOpen}
        onClose={() => setIsReplyPickerOpen(false)}
        title="Who can reply?"
        subtitle="You can change this later from the post's menu."
        options={replyPolicyOptions.map((option) => ({
          label: option.value === value.replyPolicy ? `${option.label} (selected)` : option.label,
          detail: option.detail,
          icon:
            option.value === "everyone" ? (
              <GlobeHemisphereWest24Icon size={20} color={colors.textMuted} />
            ) : option.value === "following" ? (
              <Users24Icon size={20} color={colors.textMuted} />
            ) : option.value === "followers" ? (
              <UserPlus24Icon size={20} color={colors.textMuted} />
            ) : option.value === "mentioned" ? (
              <At24Icon size={20} color={colors.textMuted} />
            ) : (
              <BellSlash24Icon size={20} color={colors.textMuted} />
            ),
          onPress: () => {
            onChange({ ...value, replyPolicy: option.value });
            setIsReplyPickerOpen(false);
          },
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  texts: { flex: 1, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
