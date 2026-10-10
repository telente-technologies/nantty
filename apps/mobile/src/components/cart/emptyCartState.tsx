import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { CategoryTabs } from "@/components/home/categoryTabs";
import { ShoppingCart48Icon } from "@/components/icons";
import { FeaturedProductsGrid } from "@/components/product/featuredProductsGrid";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { categoriesService } from "@/services/catalog/categories.service";
import { productsService } from "@/services/sellers/products.service";

export function EmptyCartState() {
  const { colors } = useTheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesService.fetchProductCategories });
  const featured = useQuery({ queryKey: ["products", "featured"], queryFn: productsService.fetchFeaturedProducts });
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <ShoppingCart48Icon />
        <View style={styles.texts}>
          <Text size={16} weight={500} lineHeight={19.2} align="center" accessibilityRole="header">
            Add items to start a Cart
          </Text>
          <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
            Once you add items from stores or vendors, your cart will show up here.
          </Text>
        </View>
      </View>
      <View style={styles.tabs}>
        <CategoryTabs
          categories={categories.data ?? []}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          tone="primary"
          background={colors.background}
        />
      </View>
      <FeaturedProductsGrid products={featured.data ?? []} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  message: { marginTop: 249, paddingHorizontal: 53, alignItems: "center", gap: 24 },
  texts: { gap: 12 },
  tabs: { marginTop: 85, marginBottom: 12 },
});
