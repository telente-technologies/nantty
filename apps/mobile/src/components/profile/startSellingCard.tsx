import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { StyleSheet, View } from "react-native";

import { BuildingStore20Icon } from "@/components/icons";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { sellerService } from "@/services/sellers/seller.service";

export function StartSellingCard({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const application = useQuery({ queryKey: sellerQueryKeys.application, queryFn: sellerService.fetchMySellerApplication });
  const underReview = application.data?.status === "pending";
  return (
    <View style={[styles.card, compact && styles.compact]}>
      <View style={styles.titleRow}>
        <BuildingStore20Icon color={colors.primary} />
        <Text size={15} weight={600} lineHeight={18}>{underReview ? "Your store application is under review" : "Start selling on Zudomart"}</Text>
      </View>
      <Text size={13} lineHeight={17.5} color={colors.textMuted}>
        {underReview
          ? "We'll notify you once it's approved — usually within 2 working days."
          : "Open a store in minutes. Buyers pay into escrow, so you're always paid for what you ship."}
      </Text>
      <Button
        title={underReview ? "Check status" : "Start selling"}
        variant={underReview ? "subtle" : "primary"}
        height={40}
        onPress={() => navigation.navigate(underReview ? "SellerApplicationStatus" : "SellerApplication")}
      />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.primaryTint, borderRadius: 12, padding: 14, gap: 8 },
  compact: { marginHorizontal: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
}));
