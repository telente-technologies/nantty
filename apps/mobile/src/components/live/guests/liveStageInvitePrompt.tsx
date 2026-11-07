import { StyleSheet, View } from "react-native";

import { UserPlus24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { ModalActionStack } from "@/components/ui/modalActions";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { UserSummary } from "@/types";
import type { GuestSlot } from "@/types/liveStage.type";

import { LiveAvatarRing } from "../liveAvatarRing";

export interface LiveStageInvitePromptProps {
  readonly invite: GuestSlot | null;
  readonly host: UserSummary;
  readonly isResponding: boolean;
  readonly onAccept: (inviteId: string) => void;
  readonly onDecline: (inviteId: string) => void;
}

export function LiveStageInvitePrompt({ invite, host, isResponding, onAccept, onDecline }: LiveStageInvitePromptProps) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={invite !== null} onClose={() => invite && onDecline(invite.id)} floating>
      <View style={styles.body}>
        <LiveAvatarRing size={64}>
          <Avatar uri={host.avatarUrl} size={64} />
        </LiveAvatarRing>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <UserPlus24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={18} weight={600} lineHeight={24} align="center" accessibilityRole="header" style={styles.title}>
          {host.name} invited you to join the LIVE as {invite?.title?.trim() || (invite?.stageRole === "cohost" ? "Co-host" : "Speaker")}
        </Text>
        <Text size={14} lineHeight={20} color={colors.textMuted} align="center">
          Your camera and mic will be shown to everyone watching. You can leave the stage anytime.
        </Text>
        <ModalActionStack
          style={styles.actions}
          actions={[
            { label: "Join stage", style: "primary", loading: isResponding, onPress: () => invite && onAccept(invite.id) },
            { label: "Not now", style: "secondary", disabled: isResponding, onPress: () => invite && onDecline(invite.id) },
          ]}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 8, alignItems: "center" },
  title: { marginTop: 8 },
  actions: { alignSelf: "stretch", marginTop: 12 },
});
