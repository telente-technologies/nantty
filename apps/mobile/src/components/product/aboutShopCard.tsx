import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Star16Icon } from "@/components/icons";
import { EarnBackLine } from "@/components/store/earnBackLine";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";
import type { StoreSummary } from "@/types";

export interface AboutShopCardProps {
  readonly store: StoreSummary;
  readonly following: boolean;
  readonly onToggleFollow: () => void;
  readonly onViewShop: () => void;
}

export function AboutShopCard({ store, following, onToggleFollow, onViewShop }: AboutShopCardProps) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">
        About this shop
      </Text>
      <View style={styles.shopRow}>
        <View style={styles.logo}>
          {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={styles.shopText}>
          <View style={styles.nameRow}>
            <Text size={14} weight={500} lineHeight={16.8}>
              {store.name}
            </Text>
            <VerificationBadge verification={store.verification} size={16} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.rating}>
              <Text size={14} weight={700} lineHeight={16.8}>
                {store.rating.toFixed(1)}
              </Text>
              <Star16Icon />
            </View>
            <View style={styles.counts}>
              <Text size={13} lineHeight={16.9}>
                ({store.ratingCount})
              </Text>
              <View style={styles.separator} />
              <Text size={13} lineHeight={16.9}>
                ({store.reviewCount} reviews)
              </Text>
            </View>
          </View>
        </View>
      </View>
      <EarnBackLine basisPoints={store.earnBackBasisPoints} />
      <View style={styles.buttons}>
        <Button variant="neutral" title={following ? "Following" : "Follow"} onPress={onToggleFollow} style={styles.button} />
        <Button title="View Shop" onPress={onViewShop} style={styles.button} />
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  card: { paddingHorizontal: 12, gap: 12 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  logo: { width: 60, height: 60, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  shopText: { gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  rating: { flexDirection: "row", alignItems: "center", gap: 2 },
  counts: { flexDirection: "row", alignItems: "center", gap: 4 },
  separator: { width: 1, height: 12, backgroundColor: scheme === "dark" ? colors.textSubtle : colors.black },
  buttons: { flexDirection: "row", gap: 8 },
  button: { flex: 1 },
}));
