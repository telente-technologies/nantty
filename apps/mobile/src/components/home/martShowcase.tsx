import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { MagnifyingGlass16AltIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MartHome } from "@/types/commerce.type";

export interface MartShowcaseProps {
  readonly martHome: MartHome | undefined;
  readonly onPressSearch: () => void;
  readonly onPressTile: (tile: "sales" | "brands" | "arrivals") => void;
}

export function MartShowcase({ martHome, onPressSearch, onPressTile }: MartShowcaseProps) {
  const tile = (kind: "sales" | "brands" | "arrivals", label: string, imageUrl: string | null | undefined, style: object) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => onPressTile(kind)} style={[styles.tile, style]}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} style={kind === "sales" ? styles.salesLabel : styles.tileLabel}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="search" accessibilityLabel="Search for anything" onPress={onPressSearch} style={styles.search}>
        <MagnifyingGlass16AltIcon />
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          Search for anything...
        </Text>
      </Pressable>
      <View style={styles.hero}>
        {martHome?.banners[0]?.imageUrl ? (
          <Image source={{ uri: martHome.banners[0].imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
      </View>
      <View style={styles.tiles}>
        {tile("sales", "Sales of the Day", martHome?.salesOfTheDayImageUrl, styles.salesTile)}
        <View style={styles.tileColumn}>
          {tile("brands", "Featured Brands", martHome?.featuredBrandsImageUrl, styles.smallTile)}
          {tile("arrivals", "New Arrivals", martHome?.newArrivalsImageUrl, styles.smallTile)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 12, paddingTop: 12, gap: 12 },
  search: {
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  hero: { height: 120, borderRadius: 4, backgroundColor: colors.placeholder, overflow: "hidden" },
  tiles: { height: 240, flexDirection: "row", gap: 7 },
  tile: { borderRadius: 4, backgroundColor: colors.placeholder, overflow: "hidden" },
  salesTile: { flex: 181 },
  tileColumn: { flex: 180, gap: 8 },
  smallTile: { flex: 1 },
  salesLabel: { position: "absolute", top: 9, left: 10, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  tileLabel: { position: "absolute", top: 12, left: 12, backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
});
