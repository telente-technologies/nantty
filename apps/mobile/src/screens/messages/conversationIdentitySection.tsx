import { Pressable, View } from "react-native";

import { BusinessLabel } from "@/components/chat/businessLabel";
import { describeConversationForDisplay } from "@/components/chat/conversationDisplay.util";
import { SecurityCodeRow } from "@/components/chatSafety/securityCode";
import { LockSimple24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { IconRow } from "@/components/ui/iconRow";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import type { Conversation } from "@/types";
import { useTheme } from "@/theme";
import { typeScale } from "@/constants/typography.constant";

import { useStyles } from "./conversationInfo.styles";

type ConversationDisplay = NonNullable<ReturnType<typeof describeConversationForDisplay>>;

interface ConversationIdentitySectionProps {
  readonly conversation: Conversation;
  readonly display: ConversationDisplay;
  readonly photoChangePending: boolean;
  readonly photoChangeError: unknown;
  readonly onChangeGroupPhoto: () => void;
}

export function ConversationIdentitySection({
  conversation,
  display,
  photoChangePending,
  photoChangeError,
  onChangeGroupPhoto,
}: ConversationIdentitySectionProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const canChangePhoto = display.isGroup && display.isAdmin && conversation.hasGroupKey;

  return (
    <>
      <View style={styles.encryptionNotice} accessibilityRole="text">
        <IconRow icon={<LockSimple24Icon size={14} color={colors.textMuted} />} justify="center" gap={6}>
          <Text size={typeScale.xs} lineHeight={17} color={colors.textMuted} align="center" style={{ flexShrink: 1 }}>
            Messages are end-to-end encrypted. Only people in this chat can read them.
          </Text>
        </IconRow>
      </View>
      <View style={styles.identity}>
        {canChangePhoto ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Change group photo" disabled={photoChangePending} onPress={onChangeGroupPhoto}>
            <Avatar uri={display.avatarUrl ?? null} size={72} placeholderColor={colors.placeholder} />
          </Pressable>
        ) : (
          <Avatar uri={display.avatarUrl ?? null} size={72} placeholderColor={colors.placeholder} />
        )}
        {photoChangeError ? (
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.error}>
            {describeActionFailure(photoChangeError)}
          </Text>
        ) : null}
        <View style={styles.nameRow}>
          <Text size={18} weight={600} lineHeight={21.6} align="center">{display.displayName}</Text>
          {display.isBusiness ? <BusinessLabel /> : null}
        </View>
        {display.subtitle ? (
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>{display.subtitle}</Text>
        ) : null}
      </View>
      {!display.isGroup && !display.isChannel ? (
        <View style={styles.section}>
          <SecurityCodeRow peerId={conversation.peer.id} />
        </View>
      ) : null}
    </>
  );
}
