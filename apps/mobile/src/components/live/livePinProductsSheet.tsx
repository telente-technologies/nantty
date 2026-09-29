import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { creatorsService } from "@/services/creators.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export interface LivePinProductsSheetProps {
  readonly visible: boolean;
  readonly liveId: string;
  readonly pinnedProductId: string | null;
  readonly onClose: () => void;
}

export function LivePinProductsSheet({ visible, liveId, pinnedProductId, onClose }: LivePinProductsSheetProps) {
  const queryClient = useQueryClient();
  const affiliatedProducts = useQuery({
    queryKey: ["creator-affiliated-products"],
    queryFn: creatorsService.fetchMyAffiliatedProducts,
    enabled: visible,
    staleTime: 5 * 60_000,
  });
  const pinProduct = useMutation({
    mutationFn: (productId: string) => creatorsService.pinProductToLive(liveId, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live", liveId] }),
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pin a product" floating>
      <View style={styles.list}>
        {affiliatedProducts.isPending ? <ActivityIndicator color={colors.primary} /> : null}
        {affiliatedProducts.data?.length === 0 ? (
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>
            You're not affiliated with any sellers yet.
          </Text>
        ) : null}
        {(affiliatedProducts.data ?? []).map((product) => {
          const isPinned = product.id === pinnedProductId;
          return (
            <Pressable
              key={product.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isPinned }}
              accessibilityLabel={isPinned ? `${product.name}, pinned` : `Pin ${product.name}`}
              disabled={pinProduct.isPending}
              onPress={() => pinProduct.mutate(product.id)}
              style={styles.row}
            >
              <View style={styles.thumb} />
              <Text size={14} lineHeight={16.8} numberOfLines={1} style={styles.name}>
                {product.name}
              </Text>
              <Text size={14} weight={600} lineHeight={16.8}>
                {formatMoneyForDisplay(product.price, { showDecimals: false })}
              </Text>
              <Text size={12} weight={600} lineHeight={14.4} color={isPinned ? colors.primary : colors.textMuted}>
                {isPinned ? "Pinned" : "Pin"}
              </Text>
            </Pressable>
          );
        })}
        {pinProduct.isError ? (
          <Text size={12} lineHeight={16.8} color={colors.error}>
            We couldn't pin that product. Try again.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { height: 48, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thumb: { width: 40, height: 40, borderRadius: 4, backgroundColor: colors.avatar },
  name: { flex: 1 },
});
