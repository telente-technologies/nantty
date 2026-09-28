import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "@/constants/colors";

export interface AvatarProps {
  readonly uri?: string | null;
  readonly size?: number;
  readonly placeholderColor?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function Avatar({ uri, size = 32, placeholderColor = colors.avatar, style }: AvatarProps) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[shape, styles.clip, { backgroundColor: placeholderColor }, style]}>
      {uri ? <Image source={{ uri }} style={shape} contentFit="cover" transition={150} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: "hidden" } });
