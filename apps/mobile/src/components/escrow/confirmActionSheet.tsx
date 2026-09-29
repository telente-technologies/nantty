import { StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface ConfirmActionSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmTitle: string;
  readonly confirming: boolean;
  readonly errorMessage?: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function ConfirmActionSheet({ visible, title, message, confirmTitle, confirming, errorMessage, onConfirm, onClose }: ConfirmActionSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <Text size={14} lineHeight={19.6} color={colors.textMuted}>
          {message}
        </Text>
        {errorMessage ? (
          <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}
        <Button title={confirmTitle} loading={confirming} onPress={onConfirm} />
        <Button variant="subtle" title="Not yet" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 } });
