import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";

import { BookmarkSimple24Icon } from "@/components/icons";
import { SAVED_ITEM_FILTERS, SavedFilterTabs } from "@/components/saves/savedFilterTabs";
import { SavedItemTile } from "@/components/saves/savedItemTile";
import { BrandLoader } from "@/components/ui/brandLoader";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { savedItemsQueryKeyPrefix } from "@/hooks/useSaveToggle.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { savesService } from "@/services/social/saves.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { SavedItem, SavedItemFilter } from "@/types";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const GRID_COLUMNS = 3;
const GRID_GAP = 1;
const MAXIMUM_GRID_WIDTH = 393;

const EMPTY_STATE_TITLE: Record<SavedItemFilter, string> = {
  all: "Nothing saved yet",
  post: "No saved posts",
  video: "No saved videos",
  clip: "No saved clips",
  product: "No saved products",
  comment: "No saved replies",
};

export function SavedScreen({ navigation, route }: MainScreenProps<"Saved">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const requestedFilter = route.params?.initialFilter;
  const [filter, setFilter] = useState<SavedItemFilter>(requestedFilter ?? "all");
  const [appliedRequestedFilter, setAppliedRequestedFilter] = useState(requestedFilter);
  if (requestedFilter !== appliedRequestedFilter) {
    setAppliedRequestedFilter(requestedFilter);
    if (requestedFilter) setFilter(requestedFilter);
  }
  const { width: windowWidth } = useWindowDimensions();
  const gridWidth = Math.min(windowWidth, MAXIMUM_GRID_WIDTH);
  const tileWidth = (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const savedItems = useInfiniteQuery({
    queryKey: [...savedItemsQueryKeyPrefix, filter],
    queryFn: ({ pageParam }) => savesService.fetchSavedItemsPage(filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const items = savedItems.data?.pages.flatMap((page) => page.data) ?? [];

  const openSavedItem = (item: SavedItem) => {
    if (item.type === "product") navigation.navigate("ProductDetail", { productId: item.targetId });
    else if (item.type === "clip") navigation.navigate("Tabs", { screen: "Clips", params: { startId: item.targetId } });
    else if (item.type === "comment") navigation.navigate("CommentThread", { commentId: item.targetId, postId: item.postId ?? item.comment.postId });
    else navigation.navigate("PostDetail", { postId: item.targetId });
  };

  const filterLabel = SAVED_ITEM_FILTERS.find((candidate) => candidate.value === filter)?.label ?? "All";

  return (
    <Screen background={colors.surface}>
      <Header title="Saved" />
      <SavedFilterTabs selectedFilter={filter} onSelectFilter={setFilter} />
      {savedItems.isLoading ? (
        <ListSkeleton />
      ) : savedItems.isError && items.length === 0 ? (
        <ErrorState error={savedItems.error} message="Couldn't load your saved items." onRetry={() => savedItems.refetch()} />
      ) : (
        <FlatList
          key={filter}
          data={items}
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.id}
          accessibilityLabel={`Saved ${filterLabel.toLowerCase()}`}
          style={styles.list}
          contentContainerStyle={[styles.grid, { width: gridWidth }]}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <SavedItemTile item={item} width={tileWidth} onPress={() => openSavedItem(item)} />}
          refreshing={savedItems.isRefetching && !savedItems.isFetchingNextPage}
          onRefresh={() => savedItems.refetch()}
          onEndReached={() => savedItems.hasNextPage && !savedItems.isFetchingNextPage && savedItems.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <View style={styles.empty}>
              <BookmarkSimple24Icon size={40} color={colors.textSubtle} />
              <Text size={typeScale.base} weight={600} lineHeight={19.2} align="center">
                {EMPTY_STATE_TITLE[filter]}
              </Text>
              <Text size={typeScale.sm} lineHeight={18.2} color={colors.textMuted} align="center">
                Tap the bookmark on posts, videos, clips and products to keep them here. Only you can see what you save.
              </Text>
            </View>
          }
          ListFooterComponent={savedItems.isFetchingNextPage ? <BrandLoader size="sm" style={styles.footer} /> : undefined}
        />
      )}
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: colors.surface },
    grid: { alignSelf: "center", gap: GRID_GAP, paddingBottom: spacing[6] },
    gridRow: { gap: GRID_GAP },
    empty: { alignItems: "center", gap: 10, paddingHorizontal: spacing[8], paddingTop: 80 },
    footer: { paddingVertical: spacing[4] },
  }),
);
