import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { BusinessDocumentsNudge } from "@/components/seller/businessDocumentsNudge";
import { PostCard } from "@/components/feed/postCard";
import { useConfirmedFollowToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { ProductMasonry } from "@/components/home/productMasonry";
import { DotsThreeVertical24Icon, Frame75132Icon, Frame75232Icon, Frame75332Icon } from "@/components/icons";
import { ContentOptionsSheet } from "@/components/moderation/contentOptionsSheet";
import { StoreProfileHeader } from "@/components/store/storeProfileHeader";
import { StoreTabs, type StoreTab } from "@/components/store/storeTabs";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { webAppLinks } from "@/config/webAppLinks.config";
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
import { canPromoteStore } from "@/utils/storePromotion.util";

export function StoreScreen({ navigation, route }: MainScreenProps<"Store">) {
  const { colors } = useTheme();
  const { storeId } = route.params;
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const [activeTab, setActiveTab] = useState<StoreTab>("products");
  const [isStoreOptionsOpen, setIsStoreOptionsOpen] = useState(false);
  const store = useQuery({ queryKey: ["stores", storeId], queryFn: () => storesService.fetchStoreById(storeId) });
  const products = useQuery({ queryKey: ["products", "store", storeId], queryFn: () => storesService.fetchStoreProducts(storeId) });
  const myStores = useQuery({ queryKey: ["my-stores"], queryFn: storesService.fetchMyStores, enabled: Boolean(signedInUserId), retry: false, staleTime: 5 * 60_000 });

  useEffect(() => {
    void trackProductInteraction("seller.viewed", { storeId });
  }, [storeId]);

  const { toggle: toggleFollow } = useConfirmedFollowToggle();
  const applyStoreFollow = (state: FollowState, followers?: number) =>
    queryClient.setQueryData<StoreDetail>(["stores", storeId], (cached) => {
      const following = state === "accepted";
      return cached ? { ...cached, isFollowing: following, followers: followers ?? Math.max(0, cached.followers + (following === cached.isFollowing ? 0 : following ? 1 : -1)) } : cached;
    });

  const { offerSendInChat, sendInChatElement } = useShareToChat();

  const topBar = (
    <View style={styles.topBar}>
      <Pressable style={styles.topActionButton} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()}>
        <Frame75332Icon />
      </Pressable>
      <View style={styles.topActions}>
        <Pressable style={styles.topActionButton} accessibilityRole="button" accessibilityLabel="Search" onPress={() => navigation.navigate("Search", store.data ? { scope: `store:${storeId}`, scopeLabel: store.data.name } : { scope: "mart" })}>
          <Frame75232Icon />
        </Pressable>
        <Pressable style={styles.topActionButton} accessibilityRole="button" accessibilityLabel="Share store" onPress={() => offerSendInChat({ kind: "store", id: storeId })}>
          <Frame75132Icon />
        </Pressable>
        <Pressable style={styles.topActionButton} accessibilityRole="button" accessibilityLabel="More store options" onPress={() => setIsStoreOptionsOpen(true)}>
          <DotsThreeVertical24Icon />
        </Pressable>
      </View>
      <ContentOptionsSheet
        target={store.data && isStoreOptionsOpen ? {
          targetType: "store",
          targetId: store.data.id,
          authorId: store.data.ownerUserId,
          shareUrl: webAppLinks.store(store.data.id),
        } : null}
        onClose={() => setIsStoreOptionsOpen(false)}
      />
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
            follow: async () => {
              const result = await storesService.followStore(storeId);
              const state = result.isFollowing ? "accepted" : "none";
              applyStoreFollow(state, result.followers);
              return { state };
            },
            unfollow: async () => {
              const result = await storesService.unfollowStore(storeId);
              const state = result.isFollowing ? "accepted" : "none";
              applyStoreFollow(state, result.followers);
              return { state };
            },
          }), undefined, "follow shops")}
          onMessage={() => requireAuthThen(() => navigation.navigate("Chat", { storeId, name: detail.name }), undefined, "message sellers")}
        />
        {canPromoteStore({ storeId, storeOwnerUserId: detail.ownerUserId, signedInUserId, myStores: myStores.data }) ? (
          <Button variant="subtle" title="Promote store" height={38} style={styles.promote} onPress={() => navigation.navigate("PromoteDestination", { destinationType: "store", targetId: storeId })} />
        ) : null}
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
  topBar: { minHeight: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: 2 },
  topActionButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingTop: 8, paddingBottom: 24 },
  tabBody: { marginTop: 12 },
  promote: { marginHorizontal: 16, marginTop: 12 },
});
