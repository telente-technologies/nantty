import { useEffect, useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { calculateDefaultLetterSpacing, fontFamily } from "@/constants/typography.constant";
import type { ClipSound, UpdateSoundInput } from "@/types";

export interface SoundOwnerControlsProps {
  readonly sound: ClipSound;
  readonly isSaving: boolean;
  readonly errorMessage: string | null;
  readonly onUpdate: (input: UpdateSoundInput) => void;
}

const MAXIMUM_SOUND_TITLE_LENGTH = 80;

export function SoundOwnerControls({ sound, isSaving, errorMessage, onUpdate }: SoundOwnerControlsProps) {
  const [draftTitle, setDraftTitle] = useState(sound.title);
  useEffect(() => setDraftTitle(sound.title), [sound.title]);
  const trimmedTitle = draftTitle.trim();
  const canRename = trimmedTitle.length > 0 && trimmedTitle !== sound.title;

  return (
    <View style={styles.root}>
      <Text size={14} weight={600} lineHeight={16.8}>
        Your sound
      </Text>
      <View style={styles.renameRow}>
        <TextInput
          value={draftTitle}
          onChangeText={setDraftTitle}
          maxLength={MAXIMUM_SOUND_TITLE_LENGTH}
          placeholder="Name your sound"
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          accessibilityLabel="Sound name"
          style={styles.input}
        />
        <Button title="Rename" height={40} disabled={!canRename} loading={isSaving} onPress={() => onUpdate({ title: trimmedTitle })} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text size={14} lineHeight={16.8}>
            Allow others to use this sound
          </Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>
            Clips using it always credit you and link back here
          </Text>
        </View>
        <Switch
          accessibilityLabel="Allow others to use this sound"
          value={sound.allowReuse}
          disabled={isSaving}
          onValueChange={(allowReuse) => onUpdate({ allowReuse })}
          trackColor={{ true: colors.primary, false: colors.divider }}
        />
      </View>
      {errorMessage ? (
        <Text size={13} lineHeight={16.9} color={colors.error}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: 16, padding: 12, gap: 12, borderWidth: 1, borderColor: colors.divider, borderRadius: 8 },
  renameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    fontFamily: fontFamily[400],
    fontSize: 14,
    letterSpacing: calculateDefaultLetterSpacing(14),
    color: colors.text,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchText: { flex: 1, gap: 2 },
});
