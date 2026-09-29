import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export function ClipReadabilityScrim({ edge, height }: { edge: "top" | "bottom"; height: number }) {
  const gradientId = `clip-scrim-${edge}`;
  const isTop = edge === "top";
  return (
    <View pointerEvents="none" style={[styles.scrim, isTop ? { top: 0, height } : { bottom: 0, height }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={isTop ? 0.45 : 0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={isTop ? 0 : 0.55} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0 },
});
