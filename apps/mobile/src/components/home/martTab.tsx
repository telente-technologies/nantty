import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type ScrollViewInstance } from "react-native";

import { BrandLoader } from "@/components/ui/brandLoader";
import { makeThemedStyles } from "@/theme";
import { adEventsService } from "@/services/ads/adEvents.service";
import { productsService } from "@/services/sellers/products.service";
import type { MartHighlight } from "@/types/martHighlight.type";

import { CategoryTabs } from "./categoryTabs";
import { useMartHighlights } from "./martHighlights.hook";
import { MartShowcase } from "./martShowcase";
import { ProductMasonry } from "./productMasonry";
import { SellOnNanttyBanner } from "./sellOnNanttyBanner";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { GridSkeleton } from "@/components/ui/gridSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { spacing } from "@/constants/spacing.constant";
import { MartProductAd } from "@/components/ads/martProductAd";
import { ProductsYouMightLike } from "@/components/home/productsYouMightLike";

const COLLECTION_FOR_TILE = {
  sales: { collection: "sales_of_the_day", name: "Sales of the Day" },
  brands: { collection: "featured_brands", name: "Featured Brands" },
  arrivals: { collection: "new_arrivals", name: "New Arrivals" },
} as const;

const STICKY_CATEGORY_INDEX = 1;

const isNearBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) =>
  layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;

export function MartTab() {
  const styles = useStyles();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);
  const categoriesY = useRef(0);
  const heroBottom = useRef(0);
  const [pinned, setPinned] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const martHome = useQuery({ queryKey: ["mart-home"], queryFn: productsService.fetchMartHome });
  const highlights = useMartHighlights();
  const products = useInfiniteQuery({
    queryKey: ["products", "page", selectedCategoryId],
    queryFn: ({ pageParam }) => productsService.fetchProductsPage(selectedCategoryId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const allProducts = (products.data?.pages ?? []).flatMap((page) => page.data);
  const refreshControl = usePullToRefresh(products.refetch, martHome.refetch, highlights.refetch);

  const openHighlight = (highlight: MartHighlight) => {
    const { target } = highlight;
    if (target.type === "product") {
      if (highlight.sponsored) adEventsService.recordSponsoredClick(highlight.sponsored, "mart", target.productId);
      navigation.navigate("ProductDetail", { productId: target.productId });
    } else if (target.type === "collection") navigation.navigate("Category", { categoryId: target.collection, name: target.name, collection: target.collection });
    else navigation.navigate("Category", { categoryId: target.categoryId, name: target.name });
  };

  const selectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    if (scrollY.current > categoriesY.current) scrollRef.current?.scrollTo({ y: categoriesY.current, animated: false });
  };

  const onScroll = (event: NativeScrollEvent) => {
    const y = event.contentOffset.y;
    scrollY.current = y;
    const nextPinned = categoriesY.current > 0 && y >= categoriesY.current;
    if (nextPinned !== pinned) setPinned(nextPinned);
    const nextHeroVisible = heroBottom.current === 0 || y < heroBottom.current;
    if (nextHeroVisible !== heroVisible) setHeroVisible(nextHeroVisible);
    if (isNearBottom(event) && products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      stickyHeaderIndices={[STICKY_CATEGORY_INDEX]}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      onScroll={({ nativeEvent }) => onScroll(nativeEvent)}
      refreshControl={refreshControl}
    >
      <View style={styles.top}>
        <MartShowcase
          martHome={martHome.data}
          onPressSearch={() => navigation.navigate("Search", { scope: "mart" })}
          onPressTile={(tile) => {
            const target = COLLECTION_FOR_TILE[tile];
            navigation.navigate("Category", { categoryId: target.collection, name: target.name, collection: target.collection });
          }}
          carousel={{
            highlights: highlights.highlights,
            loading: highlights.isLoading,
            visible: heroVisible,
            onPressHighlight: openHighlight,
            onLayout: ({ nativeEvent }) => { heroBottom.current = nativeEvent.layout.y + nativeEvent.layout.height; },
          }}
        />
        <SellOnNanttyBanner />
      </View>
      <View
        style={[styles.categories, pinned && styles.categoriesPinned]}
        onLayout={({ nativeEvent }) => { categoriesY.current = nativeEvent.layout.y; }}
        accessibilityLabel="Product categories"
      >
        <CategoryTabs categories={martHome.data?.categories ?? []} selectedCategoryId={selectedCategoryId} onSelectCategory={selectCategory} />
      </View>
      <View style={styles.content}>
        <MartProductAd />
        <ProductsYouMightLike />
        {products.isLoading ? (
          <GridSkeleton />
        ) : allProducts.length === 0 && products.isError ? (
          <ErrorState error={products.error} compact message="Couldn't load products." onRetry={() => products.refetch()} retrying={products.isRefetching} />
        ) : allProducts.length === 0 ? (
          <EmptyState compact title="No products here yet" body="Try another category or search the mart." actionLabel="Search the mart" onAction={() => navigation.navigate("Search", { scope: "mart" })} />
        ) : (
          <ProductMasonry products={allProducts} />
        )}
        {products.isFetchingNextPage ? <BrandLoader size="sm" style={styles.footer} /> : <View style={styles.footer} />}
      </View>
    </ScrollView>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  top: { paddingBottom: spacing[6] },
  categories: { paddingVertical: spacing[2], backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "transparent" },
  categoriesPinned: { borderBottomColor: colors.divider },
  content: { paddingTop: spacing[1], minHeight: 600 },
  footer: { paddingVertical: spacing[4] },
}));
