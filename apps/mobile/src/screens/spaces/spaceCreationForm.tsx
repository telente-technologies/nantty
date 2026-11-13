import { useTheme } from "@/theme";
import { Pressable, TextInput, View } from "react-native";
import {
  Broadcast24Icon,
  CalendarDots24Icon,
  ChatCircle24Icon,
  Coin24Icon,
  FileLock24Icon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { SpaceVisibility } from "@/services/spaces.service";
import type { useSpacesStyles } from "./spaces.styles";
import { SpaceSchedulePicker } from "./spaceSchedulePicker";

type SpaceStyles = ReturnType<typeof useSpacesStyles>;

export interface SpaceCreationFormProps {
  readonly styles: SpaceStyles;
  readonly creatorAccess: { readonly allowed: boolean; readonly loading: boolean; readonly label: string };
  readonly title: string;
  readonly onTitleChange: (value: string) => void;
  readonly description: string;
  readonly onDescriptionChange: (value: string) => void;
  readonly scheduledAt: string;
  readonly onScheduledAtChange: (value: string) => void;
  readonly audiencePolicy: SpaceVisibility;
  readonly onAudiencePolicyChange: (value: SpaceVisibility) => void;
  readonly coinDonationsEnabled: boolean;
  readonly onCoinDonationsEnabledChange: (value: boolean) => void;
  readonly pendingAnnouncementRetry: boolean;
  readonly busy: boolean;
  readonly onCreatorAccess: () => void;
  readonly onCreate: () => void;
}

export function SpaceCreationForm({
  styles,
  creatorAccess,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  scheduledAt,
  onScheduledAtChange,
  audiencePolicy,
  onAudiencePolicyChange,
  coinDonationsEnabled,
  onCoinDonationsEnabledChange,
  pendingAnnouncementRetry,
  busy,
  onCreatorAccess,
  onCreate,
}: SpaceCreationFormProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.form}>
      <View style={styles.composerHeading}>
        <Broadcast24Icon color={colors.primary} />
        <Text size={24} weight={700}>Create a Space</Text>
      </View>
      <Text color={colors.textMuted}>
        Creators host. Everyone can listen. Make room for your next idea.
      </Text>
      {!creatorAccess.allowed ? (
        <Button
          title={creatorAccess.loading ? "Checking creator access…" : creatorAccess.label}
          disabled={creatorAccess.loading}
          onPress={onCreatorAccess}
        />
      ) : (
        <>
          <Text weight={600}>What are you talking about?</Text>
          <TextInput
            accessibilityLabel="Space title"
            placeholder="Give your Space a title"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            value={title}
            onChangeText={onTitleChange}
            maxLength={80}
          />
          <Text weight={600}>A little context (optional)</Text>
          <TextInput
            accessibilityLabel="Space description"
            multiline
            placeholder="What can people look forward to?"
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={onDescriptionChange}
            maxLength={500}
          />
          <SpaceSchedulePicker value={scheduledAt} onChange={onScheduledAtChange} />
          <Text weight={600}>Who can join?</Text>
          <View style={styles.audienceChoices}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: audiencePolicy === "public" }}
              onPress={() => onAudiencePolicyChange("public")}
              style={[styles.audienceChoice, audiencePolicy === "public" && styles.audienceChoiceSelected]}
            >
              <Broadcast24Icon size={19} color={audiencePolicy === "public" ? colors.primary : colors.textMuted} />
              <View style={styles.audienceCopy}>
                <Text weight={600}>Public</Text>
                <Text size={12} color={colors.textMuted}>Anyone can find and listen</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: audiencePolicy === "invite_only" }}
              onPress={() => onAudiencePolicyChange("invite_only")}
              style={[styles.audienceChoice, audiencePolicy === "invite_only" && styles.audienceChoiceSelected]}
            >
              <FileLock24Icon size={19} color={audiencePolicy === "invite_only" ? colors.primary : colors.textMuted} />
              <View style={styles.audienceCopy}>
                <Text weight={600}>Invite only</Text>
                <Text size={12} color={colors.textMuted}>Only people you invite can listen</Text>
              </View>
            </Pressable>
          </View>
          <Text size={13} color={colors.textMuted}>Audio only. Your camera stays off.</Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: coinDonationsEnabled }}
            onPress={() => onCoinDonationsEnabledChange(!coinDonationsEnabled)}
            style={styles.audienceChoice}
          >
            <Coin24Icon size={19} color={coinDonationsEnabled ? colors.primary : colors.textMuted} />
            <View style={styles.audienceCopy}>
              <Text weight={600}>Allow coin support</Text>
              <Text size={12} color={colors.textMuted}>Listeners can support you with coins. You can turn this off while the Space is live.</Text>
            </View>
            <Text weight={600}>{coinDonationsEnabled ? "On" : "Off"}</Text>
          </Pressable>
          <Button
            title={pendingAnnouncementRetry ? "Retry" : scheduledAt ? "Schedule" : "Go live"}
            accessibilityLabel={pendingAnnouncementRetry ? "Retry Space announcement" : scheduledAt ? "Schedule Space" : "Start Space"}
            icon={pendingAnnouncementRetry ? <ChatCircle24Icon size={20} color={colors.onPrimary} /> : scheduledAt ? <CalendarDots24Icon size={20} color={colors.onPrimary} /> : <Broadcast24Icon size={20} color={colors.onPrimary} />}
            disabled={busy || !title.trim()}
            loading={busy}
            onPress={onCreate}
          />
        </>
      )}
    </View>
  );
}
