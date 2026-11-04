import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { InventoryCard } from "@/components/seller/inventoryCard";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { Tag24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { GridSkeleton } from "@/components/ui/gridSkeleton";
import { Header } from "@/components/ui/header";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { sellerService } from "@/services/sellers/seller.service";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { useLocaleStore } from "@/store/locale.store";
import { summariseProductForInventory } from "@/utils/sellerProductForm.util";

export function SellerProductsScreen({ navigation }: MainScreenProps<"SellerProducts">) {
  const { colors } = useTheme();
  const viewerCurrency = useLocaleStore((state) => state.currency);
  const queryClient = useQueryClient();
  const [actionFeedback, setActionFeedback] = useState<{ productId: string; kind: "success" | "error"; message: string } | null>(null);
  const { data: allProducts = [], isLoading, isError, error, refetch, isRefetching } = useQuery({ queryKey: sellerQueryKeys.products, queryFn: sellerService.listMyStoreProducts });
  const refreshControl = usePullToRefresh(refetch);
  const visibilityMutation = useMutation({
    mutationFn: async ({ productId, currentlyPublished }: { productId: string; currentlyPublished: boolean }) => {
      if (currentlyPublished) await sellerService.unpublishStoreProduct(productId);
      else await sellerService.publishStoreProduct(productId);

      let refreshedProducts;
      try {
        refreshedProducts = await queryClient.fetchQuery({
          queryKey: sellerQueryKeys.products,
          queryFn: sellerService.listMyStoreProducts,
          staleTime: 0,
        });
      } catch {
        throw new Error("The request was sent, but the latest product status couldn't be checked. Pull to refresh before trying again.");
      }

      const refreshedProduct = refreshedProducts.find((product) => product.id === productId);
      if (!refreshedProduct || refreshedProduct.publishedOnline === currentlyPublished) {
        throw new Error("The server hasn't confirmed the new status. Pull to refresh before trying again.");
      }

      return { productId, published: refreshedProduct.publishedOnline };
    },
    onMutate: () => setActionFeedback(null),
    onSuccess: ({ productId, published }) => setActionFeedback({
      productId,
      kind: "success",
      message: published ? "Product published." : "Product hidden from buyers.",
    }),
    onError: (mutationError, variables) => setActionFeedback({
      productId: variables.productId,
      kind: "error",
      message: describeActionFailure(mutationError, "Couldn't update this product's visibility. Try again."),
    }),
  });
  const products = allProducts.filter((product) => product.status !== "archived");
  return (
    <Screen>
      <Header title="Products" />
      <FlatList
        data={products}
        keyExtractor={(product) => product.id}
        numColumns={2}
        refreshControl={refreshControl}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Button title="Add product" onPress={() => navigation.navigate("ProductForm")} style={styles.add} />}
        renderItem={({ item }) => {
          const isPublished = item.publishedOnline;
          const isUpdating = visibilityMutation.isPending && visibilityMutation.variables?.productId === item.id;
          const feedback = actionFeedback?.productId === item.id ? actionFeedback : null;
          return (
            <View style={styles.productCell}>
              <InventoryCard product={summariseProductForInventory(item, viewerCurrency)} onPress={() => navigation.navigate("ProductForm", { productId: item.id })} style={styles.inventoryCard} />
              <Button
                title={isUpdating ? (isPublished ? "Hiding…" : "Publishing…") : isPublished ? "Hide" : "Publish"}
                variant={isPublished ? "neutral" : "brand"}
                height={38}
                disabled={visibilityMutation.isPending}
                loading={isUpdating}
                accessibilityLabel={`${isPublished ? "Hide" : "Publish"} ${item.name}`}
                onPress={() => visibilityMutation.mutate({ productId: item.id, currentlyPublished: isPublished })}
                style={styles.visibilityButton}
              />
              {isUpdating ? (
                <Text size={typeScale.xs} lineHeight={16.8} color={colors.textMuted} accessibilityLiveRegion="polite" style={styles.feedback}>
                  {isPublished ? "Hiding…" : "Publishing…"}
                </Text>
              ) : feedback ? (
                <Text
                  size={typeScale.xs}
                  lineHeight={16.8}
                  color={feedback.kind === "error" ? colors.error : colors.textMuted}
                  accessibilityRole={feedback.kind === "error" ? "alert" : undefined}
                  accessibilityLiveRegion="polite"
                  style={styles.feedback}
                >
                  {feedback.message}
                </Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <GridSkeleton items={4} />
          ) : isError ? (
            <ErrorState error={error} compact message="Couldn't load your products." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState compact icon={<Tag24Icon color={colors.textMuted} />} title="No products yet" body="Add your first product so buyers can find your store." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing[3], paddingBottom: spacing[8], gap: spacing[4] },
  column: { justifyContent: "space-between" },
  add: { marginTop: spacing[4], marginBottom: spacing[2] },
  productCell: { width: "48%", gap: spacing[2] },
  inventoryCard: { width: "100%" },
  visibilityButton: { alignSelf: "stretch" },
  feedback: { minHeight: 17 },
});
