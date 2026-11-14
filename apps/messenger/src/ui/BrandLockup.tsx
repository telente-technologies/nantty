import { Image, StyleSheet, Text, View } from "react-native";

import { useMessengerColors } from "./useMessengerColors";

const nanttyMark = require("../../../mobile/assets/nantty-icon.png");

export function BrandLockup({ compact = false }: { readonly compact?: boolean }) {
  const colors = useMessengerColors();
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Nantty Messenger">
      <Image source={nanttyMark} resizeMode="contain" style={[styles.mark, compact && styles.compactMark]} />
      <View>
        <Text style={[styles.brand, { color: colors.text }]}>nantty</Text>
        {compact ? null : <Text style={[styles.product, { color: colors.muted }]}>MESSENGER</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 36, height: 36 },
  compactMark: { width: 32, height: 32 },
  brand: { fontFamily: "Inter_700Bold", fontSize: 22, lineHeight: 26, fontWeight: "800", letterSpacing: -0.8 },
  product: { fontFamily: "Inter_700Bold", fontSize: 9, lineHeight: 12, letterSpacing: 1.5, fontWeight: "700", marginTop: 1 },
});
