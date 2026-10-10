import { StyleSheet, View } from "react-native";

import { Info24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface InfoSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly actionTitle?: string;
  readonly actionLoading?: boolean;
  readonly onAction?: () => void;
  readonly onClose: () => void;
}

export function InfoSheet({ visible, title, message, actionTitle, actionLoading, onAction, onClose }: InfoSheetProps) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Info24Icon size={22} color={colors.textMuted} />
        </View>
        <Text size={14} lineHeight={19.6} color={colors.textMuted}>
          {message}
        </Text>
        {actionTitle && onAction ? <Button title={actionTitle} loading={actionLoading} onPress={onAction} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 16, gap: 20 } });
