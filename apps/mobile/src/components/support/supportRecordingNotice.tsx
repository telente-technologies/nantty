import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

export function SupportRecordingNotice() {
  const styles = useStyles();
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text size={13} weight={600} lineHeight={16.9}>Nantty Support</Text>
      <Text size={12} lineHeight={16.8}>
        This chat is not end-to-end encrypted. It is recorded and reviewed for quality and safety. Never share your password, card PIN or OTP.
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ box: { backgroundColor: colors.successTint, borderRadius: 12, padding: 12, gap: 4 } }));
