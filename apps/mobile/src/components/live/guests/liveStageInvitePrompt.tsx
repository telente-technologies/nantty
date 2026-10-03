import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { UserSummary } from "@/types";
import type { GuestSlot } from "@/types/liveStage.type";

export interface LiveStageInvitePromptProps {
  readonly invite: GuestSlot | null;
  readonly host: UserSummary;
  readonly isResponding: boolean;
  readonly onAccept: (inviteId: string) => void;
  readonly onDecline: (inviteId: string) => void;
}

export function LiveStageInvitePrompt({ invite, host, isResponding, onAccept, onDecline }: LiveStageInvitePromptProps) {
  return (
    <BottomSheet visible={invite !== null} onClose={() => invite && onDecline(invite.id)} floating>
      <View style={styles.body}>
        <Avatar uri={host.avatarUrl} size={56} />
        <Text size={16} weight={600} lineHeight={20} align="center">
          {host.name} invited you to join the LIVE
        </Text>
        <Text size={13} lineHeight={18} color={colors.textMuted} align="center">
          Your camera and mic will be shown to everyone watching. You can leave the stage anytime.
        </Text>
        <View style={styles.buttons}>
          <Button title="Decline" variant="outline" style={styles.flex} onPress={() => invite && onDecline(invite.id)} />
          <Button title="Join stage" style={styles.flex} loading={isResponding} onPress={() => invite && onAccept(invite.id)} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 10, alignItems: "center" },
  buttons: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 },
  flex: { flex: 1 },
});
