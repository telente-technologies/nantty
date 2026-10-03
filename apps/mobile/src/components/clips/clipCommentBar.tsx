import { Pressable, StyleSheet, View } from "react-native";

import { Gif24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface ClipCommentBarProps {
  readonly myAvatarUrl: string | null;
  readonly onPress: () => void;
  readonly horizontalPadding?: number;
}

export function ClipCommentBar({ myAvatarUrl, onPress, horizontalPadding = 12 }: ClipCommentBarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.bar, { paddingHorizontal: horizontalPadding }]}>
      <Avatar uri={myAvatarUrl} size={32} placeholderColor={colors.placeholder} />
      <Pressable accessibilityRole="button" accessibilityLabel="Add comment" onPress={onPress} style={styles.field}>
        <Text size={13} lineHeight={16.9} color={colors.placeholder}>
          Add comment...
        </Text>
        <Gif24Icon />
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: {
    height: 50,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  field: {
    flex: 1,
    height: 34,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));
