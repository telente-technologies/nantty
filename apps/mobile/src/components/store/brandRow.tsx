import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { BrandSummary } from "@/types/brand.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

import { OfficialStoreBadge } from "./officialStoreBadge";

export function BrandRow({ brand, onPress }: { brand: BrandSummary; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Brand ${brand.name}`} onPress={onPress} style={styles.row}>
      <Image source={{ uri: brand.logoUrl ?? undefined }} style={styles.logo} contentFit="cover" />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <Text size={14} weight={500} lineHeight={16.8} numberOfLines={1}>{brand.name}</Text>
          <VerificationBadge verification={brand.verification} size={14} />
        </View>
        <Text size={12} lineHeight={16} color={colors.textSubtle}>@{brand.handle} · {formatCountWithThousandsSuffix(brand.followers)} followers</Text>
        {brand.officialStoreId ? <OfficialStoreBadge /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  logo: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.placeholder },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});
