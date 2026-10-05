import { View } from "react-native";

import { ZudomartWordmark } from "@/components/brand/zudomartWordmark";

export function BrandWordmark({ height = 30 }: { readonly height?: number }) {
  return (
    <View accessibilityRole="header" accessibilityLabel="Zudomart">
      <ZudomartWordmark height={height} />
    </View>
  );
}
