import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon, PushPin24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { creatorsService } from "@/services/creators/creators.service";
import { storesService } from "@/services/sellers/stores.service";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { readLiveErrorMessage } from "@/utils/liveStoreErrors.util";
import { makeThemedStyles, useTheme } from "@/theme";

export interface LivePinProductsSheetProps {
  readonly visible: boolean;
  readonly liveId: string;
  readonly storeId: string;
  readonly pinnedProductId: string | null;
  readonly onClose: () => void;
}

export function LivePinProductsSheet({ visible, liveId, storeId, pinnedProductId, onClose }: LivePinProductsSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const storeProducts = useQuery({
    queryKey: ["products", "store", storeId],
    queryFn: () => storesService.fetchStoreProducts(storeId),
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
        {storeProducts.isPending ? <BrandLoader size="md" /> : null}
        {storeProducts.data?.length === 0 ? (
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>
            Your store has no published products yet.
          </Text>
        ) : null}
        {(storeProducts.data ?? []).map((product) => {
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
              <View style={styles.thumb}>
                {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <Text size={14} lineHeight={16.8} numberOfLines={1} style={styles.name}>
                {product.name}
              </Text>
              <Text size={14} weight={600} lineHeight={16.8}>
                {formatMoneyForDisplay(product.price, { showDecimals: false })}
              </Text>
              <View style={styles.pinState}>
                {isPinned ? <Check16Icon color={colors.primary} /> : <PushPin24Icon size={20} color={colors.textMuted} />}
                <Text size={12} weight={600} lineHeight={14.4} color={isPinned ? colors.primary : colors.textMuted}>
                  {isPinned ? "Pinned" : "Pin"}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {pinProduct.isError ? (
          <Text size={12} lineHeight={16.8} color={colors.error}>
            {readLiveErrorMessage(pinProduct.error, "We couldn't pin that product. Try again.")}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  row: { height: 48, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  thumb: { width: 40, height: 40, borderRadius: 4, overflow: "hidden", backgroundColor: colors.placeholder },
  name: { flex: 1 },
  pinState: { flexDirection: "row", alignItems: "center", gap: 4 },
}));
