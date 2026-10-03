import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { MapPin24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { buildOpenStreetMapTileGrid } from "@/utils/mapLinks.util";

const PREVIEW_WIDTH = 232;
const PREVIEW_HEIGHT = 136;
const PIN_SIZE = 32;

export function StaticMapPreview({ latitude, longitude }: { readonly latitude: number; readonly longitude: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const grid = buildOpenStreetMapTileGrid(latitude, longitude);
  const gridLeft = PREVIEW_WIDTH / 2 - grid.pointLeft;
  const gridTop = PREVIEW_HEIGHT / 2 - grid.pointTop;
  return (
    <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel="Map preview of the shared location">
      <View style={[styles.grid, { width: grid.sizePixels, height: grid.sizePixels, left: gridLeft, top: gridTop }]}>
        {grid.tiles.map((tile) => (
          <Image key={tile.key} source={{ uri: tile.url }} style={[styles.tile, { left: tile.left, top: tile.top }]} contentFit="cover" />
        ))}
      </View>
      <View style={styles.pin} pointerEvents="none">
        <MapPin24Icon size={PIN_SIZE} color={colors.error} />
      </View>
      <View style={styles.attribution}>
        <Text size={9} lineHeight={11} letterSpacing={0} color={colors.text}>
          © OpenStreetMap
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  frame: { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, borderRadius: 8, overflow: "hidden", backgroundColor: colors.placeholder },
  grid: { position: "absolute" },
  tile: { position: "absolute", width: 256, height: 256 },
  pin: { position: "absolute", left: PREVIEW_WIDTH / 2 - PIN_SIZE / 2, top: PREVIEW_HEIGHT / 2 - PIN_SIZE },
  attribution: { position: "absolute", right: 0, bottom: 0, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: colors.surface, opacity: 0.85 },
}));
