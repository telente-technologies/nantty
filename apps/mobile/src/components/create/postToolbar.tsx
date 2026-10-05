import { Pressable, StyleSheet, View } from "react-native";

import { Camera24Icon, ImageSquare24Icon } from "@/components/icons";
import { CaretUpIcon } from "@/components/icons/phosphorGlyphs";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PostAudience } from "@/types";

import { KeyboardDoneButton } from "./keyboardDoneBar";

export interface PostToolbarProps {
  readonly audience: PostAudience;
  readonly onToggleAudience: () => void;
  readonly onTakePhoto: () => void;
  readonly onPickFromLibrary: () => void;
  readonly isKeyboardOpen?: boolean;
}

export function PostToolbar(props: PostToolbarProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tools = [
    { label: "Take a photo", icon: <Camera24Icon />, onPress: props.onTakePhoto },
    { label: "Add photos or videos", icon: <ImageSquare24Icon />, onPress: props.onPickFromLibrary },
  ];
  return (
    <View style={styles.bar}>
      <View style={styles.tools}>
        {tools.map((tool) => (
          <Pressable key={tool.label} accessibilityRole="button" accessibilityLabel={tool.label} hitSlop={8} onPress={tool.onPress}>
            {tool.icon}
          </Pressable>
        ))}
      </View>
      {props.isKeyboardOpen ? <KeyboardDoneButton /> : (
      <Pressable accessibilityRole="button" accessibilityLabel="Who can see this post" onPress={props.onToggleAudience} style={styles.audience}>
        <Text size={13} weight={500} lineHeight={16.9}>
          {props.audience === "everyone" ? "Everyone" : "Followers"}
        </Text>
        <CaretUpIcon size={12} weight="fill" color={colors.text} />
      </Pressable>
      )}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tools: { flexDirection: "row", alignItems: "center", gap: 24 },
  audience: { height: 25, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.chip, flexDirection: "row", alignItems: "center", gap: 8 },
}));
