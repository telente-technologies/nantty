import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { ProductMasonry } from "@/components/home/productMasonry";
import { Frame75132Icon, Frame75232Icon, Frame75332Icon } from "@/components/icons";
import { StoreProfileHeader } from "@/components/store/storeProfileHeader";
import { StoreTabs, type StoreTab } from "@/components/store/storeTabs";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { storesService } from "@/services/stores.service";
import type { StoreDetail } from "@/types/commerce.type";

export function StoreScreen({ navigation, route }: MainScreenProps<"Store">) {
  const { storeId } = route.params;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<StoreTab>("products");
  const store = useQuery({ queryKey: ["stores", storeId], queryFn: () => storesService.fetchStoreById(storeId) });
  const products = useQuery({ queryKey: ["products", "store", storeId], queryFn: () => storesService.fetchStoreProducts(storeId) });

  const toggleStoreFollow = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? storesService.followStore(storeId) : storesService.unfollowStore(storeId)),
    onMutate: (followNow) =>
      queryClient.setQueryData<StoreDetail>(["stores", storeId], (cached) =>
        cached ? { ...cached, isFollowing: followNow, followers: cached.followers + (followNow ? 1 : -1) } : cached,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["stores", storeId] }),
  });

  const topBar = (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => navigation.goBack()}>
        <Frame75332Icon />
      </Pressable>
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={8} onPress={() => navigation.navigate("Search", { scope: "mart" })}>
          <Frame75232Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8}>
          <Frame75132Icon />
        </Pressable>
      </View>
    </View>
  );

  if (!store.data) {
    return (
      <Screen background={colors.white}>
        {topBar}
        {store.isError ? (
          <Text align="center" color={colors.textSubtle} style={styles.state}>Couldn't load this store.</Text>
        ) : (
          <ActivityIndicator style={styles.state} color={colors.primary} />
        )}
      </Screen>
    );
  }

  const detail = store.data;
  return (
    <Screen background={colors.white}>
      {topBar}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StoreProfileHeader
          store={detail}
          onToggleFollow={() => toggleStoreFollow.mutate(!detail.isFollowing)}
          onMessage={() => navigation.navigate("Chat", { userId: detail.ownerUserId, name: detail.name })}
        />
        <StoreTabs active={activeTab} onChange={setActiveTab} />
        <View style={styles.tabBody}>
          {activeTab === "products" ? (
            <ProductMasonry products={products.data ?? []} />
          ) : (
            detail.posts.map((post) => (
              <PostCard key={post.id} post={post} onPress={() => navigation.navigate("PostDetail", { postId: post.id })} />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { height: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: 12 },
  content: { paddingTop: 8, paddingBottom: 24 },
  tabBody: { marginTop: 12 },
  state: { marginTop: 64 },
});
