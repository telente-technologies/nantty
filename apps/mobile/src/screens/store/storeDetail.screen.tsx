import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { BusinessDocumentsNudge } from "@/components/seller/businessDocumentsNudge";
import { PostCard } from "@/components/feed/postCard";
import { useConfirmedFollowToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { ProductMasonry } from "@/components/home/productMasonry";
import { Frame75132Icon, Frame75232Icon, Frame75332Icon } from "@/components/icons";
import { StoreProfileHeader } from "@/components/store/storeProfileHeader";
import { StoreTabs, type StoreTab } from "@/components/store/storeTabs";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { trackProductInteraction } from "@/services/sellers/productInteractions.service";
import { storesService } from "@/services/sellers/stores.service";
import type { StoreDetail } from "@/types/commerce.type";
import type { FollowState } from "@/types/socialGraph.type";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { useAuthStore } from "@/store/auth.store";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function StoreScreen({ navigation, route }: MainScreenProps<"Store">) {
  const { colors } = useTheme();
  const { storeId } = route.params;
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const [activeTab, setActiveTab] = useState<StoreTab>("products");
  const store = useQuery({ queryKey: ["stores", storeId], queryFn: () => storesService.fetchStoreById(storeId) });
  const products = useQuery({ queryKey: ["products", "store", storeId], queryFn: () => storesService.fetchStoreProducts(storeId) });

  useEffect(() => {
    void trackProductInteraction("seller.viewed", { storeId });
  }, [storeId]);

  const { toggle: toggleFollow } = useConfirmedFollowToggle();
  const applyStoreFollow = (state: FollowState) =>
    queryClient.setQueryData<StoreDetail>(["stores", storeId], (cached) => {
      const following = state === "accepted";
      return cached && cached.isFollowing !== following ? { ...cached, isFollowing: following, followers: Math.max(0, cached.followers + (following ? 1 : -1)) } : cached;
    });

  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const topBar = (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => navigation.goBack()}>
        <Frame75332Icon />
      </Pressable>
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Search" hitSlop={8} onPress={() => navigation.navigate("Search", store.data ? { scope: `store:${storeId}`, scopeLabel: store.data.name } : { scope: "mart" })}>
          <Frame75232Icon />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share store" hitSlop={8} onPress={() => offerSendInChat({ kind: "store", id: storeId })}>
          <Frame75132Icon />
        </Pressable>
      </View>
      {sendInChatElement}
    </View>
  );

  if (!store.data) {
    return (
      <Screen background={colors.surface}>
        {topBar}
        {store.isError ? (
          <ErrorState error={store.error} message="Couldn't load this store." onRetry={() => store.refetch()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const detail = store.data;
  return (
    <Screen background={colors.surface}>
      {topBar}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {detail.ownerUserId === signedInUserId ? <BusinessDocumentsNudge /> : null}
        <StoreProfileHeader
          store={detail}
          onToggleFollow={() => requireAuthThen(() => toggleFollow({
            subjectLabel: detail.name, state: detail.isFollowing ? "accepted" : "none", apply: applyStoreFollow,
            follow: () => storesService.followStore(storeId), unfollow: () => storesService.unfollowStore(storeId),
            onSettled: () => void queryClient.invalidateQueries({ queryKey: ["stores", storeId] }),
          }), undefined, "follow shops")}
          onMessage={() => requireAuthThen(() => navigation.navigate("Chat", { storeId, name: detail.name }), undefined, "message sellers")}
        />
        <StoreTabs active={activeTab} onChange={setActiveTab} />
        <View style={styles.tabBody}>
          {activeTab === "products" ? (
            <ProductMasonry products={products.data ?? []} />
          ) : (
            detail.posts.map((post) => (
              <PostCard key={post.id} post={post} surface="profile" onPress={() => navigation.navigate("PostDetail", { postId: post.id })} />
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
});
