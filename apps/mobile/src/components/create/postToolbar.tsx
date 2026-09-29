import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Camera24Icon, ImageSquare24Icon, MapPin24Icon, SlidersHorizontal24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { PostAudience } from "@/types";

export interface PostToolbarProps {
  readonly audience: PostAudience;
  readonly onToggleAudience: () => void;
  readonly onTakePhoto: () => void;
  readonly onPickFromLibrary: () => void;
  readonly onEditMedia: () => void;
  readonly onAddLocation: () => void;
}

export function PostToolbar(props: PostToolbarProps) {
  const tools = [
    { label: "Take a photo", icon: <Camera24Icon />, onPress: props.onTakePhoto },
    { label: "Add photos or videos", icon: <ImageSquare24Icon />, onPress: props.onPickFromLibrary },
    { label: "Edit media", icon: <SlidersHorizontal24Icon />, onPress: props.onEditMedia },
    { label: "Add location", icon: <MapPin24Icon />, onPress: props.onAddLocation },
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
      <Pressable accessibilityRole="button" accessibilityLabel="Who can see this post" onPress={props.onToggleAudience} style={styles.audience}>
        <Text size={13} weight={500} lineHeight={16.9}>
          {props.audience === "everyone" ? "Everyone" : "Followers"}
        </Text>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M1.8 8.8h8.4a.6.6 0 0 0 .47-.98l-4.2-5.1a.6.6 0 0 0-.93 0l-4.2 5.1a.6.6 0 0 0 .46.98Z" fill={colors.black} />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 42,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tools: { flexDirection: "row", alignItems: "center", gap: 24 },
  audience: { height: 25, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.chip, flexDirection: "row", alignItems: "center", gap: 8 },
});
