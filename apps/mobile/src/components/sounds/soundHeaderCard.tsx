import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { BookmarkSimple24Icon, SpeakerHigh24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { explainWhySoundCannotBeReused } from "@/services/clips/sounds.service";
import type { ClipSound } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

export interface SoundHeaderCardProps {
  readonly sound: ClipSound;
  readonly onPressOwner: () => void;
  readonly onToggleSaved: () => void;
  readonly onUseSound: () => void;
}

export function SoundHeaderCard({ sound, onPressOwner, onToggleSaved, onUseSound }: SoundHeaderCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reasonSoundCannotBeReused = explainWhySoundCannotBeReused(sound);
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.cover}>
          {sound.coverUrl ? <Image source={{ uri: sound.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : null}
          <View style={styles.coverIcon}>
            <SpeakerHigh24Icon color={colors.white} />
          </View>
        </View>
        <View style={styles.details}>
          <Text size={18} weight={600} lineHeight={21.6} numberOfLines={2} accessibilityRole="header">
            {sound.isOriginal ? "Original sound" : sound.title}
          </Text>
          <Pressable accessibilityRole="link" accessibilityLabel={`Sound by ${sound.owner.name}`} onPress={onPressOwner} style={styles.owner}>
            <Avatar uri={sound.owner.avatarUrl} size={20} />
            <Text size={13} weight={500} lineHeight={16.9} numberOfLines={1}>
              {sound.owner.name} · @{sound.owner.username}
            </Text>
          </Pressable>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            {formatCountWithThousandsSuffix(sound.usageCount)} {sound.usageCount === 1 ? "clip" : "clips"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sound.savedByViewer ? "Remove from saved sounds" : "Save sound"}
          accessibilityState={{ selected: !!sound.savedByViewer }}
          hitSlop={10}
          onPress={onToggleSaved}
          style={sound.savedByViewer ? undefined : styles.unsaved}
        >
          <BookmarkSimple24Icon color={sound.savedByViewer ? colors.primary : undefined} />
        </Pressable>
      </View>
      {sound.status === "under_copyright_review" ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text size={13} lineHeight={18.2} color={colors.textMuted}>
            This sound is unavailable while under copyright review
          </Text>
        </View>
      ) : null}
      <Button title="Use this sound" disabled={!!reasonSoundCannotBeReused} onPress={onUseSound} />
      {reasonSoundCannotBeReused && sound.status !== "under_copyright_review" ? (
        <Text size={12} lineHeight={16.8} color={colors.textMuted} align="center">
          {reasonSoundCannotBeReused}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cover: { width: 88, height: 88, borderRadius: 8, overflow: "hidden", backgroundColor: colors.media },
  coverIcon: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  details: { flex: 1, gap: 6 },
  owner: { flexDirection: "row", alignItems: "center", gap: 6 },
  unsaved: { opacity: 0.6 },
  notice: { padding: 12, borderRadius: 8, backgroundColor: colors.skeleton },
}));
