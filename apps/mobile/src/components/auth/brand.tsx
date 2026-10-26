import { View } from "react-native";

import { NanttyWordmark } from "@/components/brand/nanttyWordmark";

export function BrandWordmark({ height = 30 }: { readonly height?: number }) {
  return (
    <View accessibilityRole="header" accessibilityLabel="Nantty">
      <NanttyWordmark height={height} />
    </View>
  );
}
