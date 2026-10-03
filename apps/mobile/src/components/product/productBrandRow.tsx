import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { CaretRight24Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { OfficialStoreBadge } from "@/components/store/officialStoreBadge";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BrandTag } from "@/types/brand.type";

export function ProductBrandRow({ brand, isOfficialStore, onPress }: { brand: BrandTag; isOfficialStore: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Brand: ${brand.name}${isOfficialStore ? ", Official Store" : ""}`} onPress={onPress} style={styles.row}>
      <Image source={{ uri: brand.logoUrl ?? undefined }} style={styles.logo} contentFit="cover" />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <Text size={14} lineHeight={16.8} color={colors.textMuted}>Brand:</Text>
          <Text size={14} weight={500} lineHeight={16.8}>{brand.name}</Text>
          <VerificationBadge verification={brand.verification} size={14} />
        </View>
        {isOfficialStore ? <OfficialStoreBadge /> : <Text size={12} lineHeight={16} color={colors.textSubtle}>Sold by an independent seller</Text>}
      </View>
      <CaretRight24Icon />
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { marginHorizontal: 12, marginTop: 16, padding: 10, borderRadius: 12, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.placeholder },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
}));
