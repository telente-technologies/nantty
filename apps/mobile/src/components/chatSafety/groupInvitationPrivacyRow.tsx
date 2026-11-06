import { StyleSheet, View } from "react-native";

import { SettingToggleRow } from "@/components/chatSafety/settingToggleRow";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface GroupInvitationPrivacyRowProps {
  readonly enabled: boolean;
  readonly disabled?: boolean;
  readonly hasError?: boolean;
  readonly onChange: (enabled: boolean) => void;
}

export function GroupInvitationPrivacyRow({ enabled, disabled = false, hasError = false, onChange }: GroupInvitationPrivacyRowProps) {
  const { colors } = useTheme();
  return (
    <View>
      <SettingToggleRow
        label="Require group invitations"
        description="Stop people adding you directly to new group chats. After accepting an invitation, secure membership setup may still be required."
        value={enabled}
        disabled={disabled}
        onValueChange={onChange}
      />
      {hasError ? (
        <Text size={13} lineHeight={18} color={colors.error} accessibilityRole="alert" style={styles.error}>
          We couldn’t update your group invitation preference. Try again.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ error: { paddingHorizontal: 16, paddingBottom: 12 } });
