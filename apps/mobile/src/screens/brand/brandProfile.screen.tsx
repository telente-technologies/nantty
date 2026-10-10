import { inAppBrowserColorsFromTheme, openUserSuppliedWebLink } from "@/components/links/openLink.util";
import { MentionText } from "@/components/mentions/mentionText";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { ProductMasonry } from "@/components/home/productMasonry";
import { useUserPostsQuery } from "@/components/profile/profileQueries.hook";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { OfficialStoreBadge } from "@/components/store/officialStoreBadge";
import { webHandoffService } from "@/services/core/webHandoff.service";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { brandsService } from "@/services/sellers/brands.service";
import { useAuthStore } from "@/store/auth.store";
import type { BrandDetail } from "@/types/brand.type";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { ErrorState } from "@/components/ui/errorState";
import { PreviewableImage } from "@/components/ui/previewableImage";
import { requireAuthThen } from "@/utils/requireAuth.util";

export function BrandProfileScreen({ navigation, route }: MainScreenProps<"BrandProfile">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { brandId } = route.params;
  const queryClient = useQueryClient();
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const brand = useQuery({ queryKey: ["brands", brandId], queryFn: () => brandsService.fetchBrandById(brandId) });
  const products = useQuery({ queryKey: ["brands", brandId, "products"], queryFn: () => brandsService.fetchBrandProducts(brandId) });
  const posts = useUserPostsQuery(brand.data?.ownerUserId ?? undefined);
  const toggleFollow = useMutation({
    mutationFn: (followNow: boolean) => (followNow ? brandsService.followBrand(brandId) : brandsService.unfollowBrand(brandId)),
    onMutate: (followNow) =>
      queryClient.setQueryData<BrandDetail>(["brands", brandId], (cached) => (cached ? { ...cached, isFollowing: followNow, followers: cached.followers + (followNow ? 1 : -1) } : cached)),
  });

  if (!brand.data) {
    return (
      <Screen>
        <Header title="Brand" />
        {brand.isError ? <ErrorState message="Couldn't load this brand." onRetry={() => brand.refetch()} /> : <ListSkeleton />}
      </Screen>
    );
  }
  const details = brand.data;
  const ownsBrand = details.ownerUserId === signedInUserId;

  return (
    <Screen background={colors.surface}>
      <Header title={details.name} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          {details.coverUrl ? (
            <PreviewableImage imageUrl={details.coverUrl} accessibilityLabel="View brand cover photo" style={StyleSheet.absoluteFill}>
              <Image source={{ uri: details.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </PreviewableImage>
          ) : null}
        </View>
        <View style={styles.identity}>
          <PreviewableImage imageUrl={details.logoUrl} accessibilityLabel="View brand logo">
            <Image source={{ uri: details.logoUrl ?? undefined }} style={styles.logo} contentFit="cover" />
          </PreviewableImage>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text size={16} weight={600} lineHeight={19.2}>{details.name}</Text>
              <VerificationBadge verification={details.verification} size={20} />
            </View>
            <Text size={14} lineHeight={16.8} color={colors.textSubtle}>@{details.handle}</Text>
            <Text size={13} lineHeight={16.9}>{formatCountWithThousandsSuffix(details.followers)} followers · {details.categoryName}</Text>
          </View>
        </View>
        <MentionText text={details.description} size={13} lineHeight={17.5} style={styles.padded} />
        {details.website ? (
          <Text size={13} lineHeight={17.5} color={colors.primary} style={styles.padded} accessibilityRole="link" onPress={() => openUserSuppliedWebLink(details.website!, inAppBrowserColorsFromTheme(colors))}>{details.website}</Text>
        ) : null}
        <View style={[styles.actions, styles.padded]}>
          <Button variant={details.isFollowing ? "subtle" : "primary"} title={details.isFollowing ? "Following" : "Follow"} style={styles.flex} onPress={() => requireAuthThen(() => toggleFollow.mutate(!details.isFollowing), undefined, "follow brands")} />
          {ownsBrand && !details.verification?.badgeVisible ? (
            <Button variant="subtle" title="Manage on the web" style={styles.flex} onPress={() => webHandoffService.openManageBilling(details.id)} />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitle}>
            <Text size={16} weight={600} lineHeight={19.2}>Official store</Text>
            {details.officialStore ? <OfficialStoreBadge /> : null}
          </View>
          {details.officialStore ? (
            <Text size={13} weight={500} lineHeight={16.9} color={colors.primary} style={styles.padded} onPress={() => navigation.navigate("Store", { storeId: details.officialStore!.id })}>
              Visit {details.officialStore.name}
            </Text>
          ) : (
            <Text size={13} lineHeight={17.5} color={colors.textMuted} style={styles.padded}>{details.name} hasn't opened a verified official store yet.</Text>
          )}
          {(products.data?.officialStoreProducts.length ?? 0) > 0 ? <ProductMasonry products={products.data!.officialStoreProducts} /> : null}
        </View>

        {(products.data?.otherSellersProducts.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <Text size={16} weight={600} lineHeight={19.2} style={styles.padded}>Also sold by other sellers</Text>
            <Text size={12} lineHeight={16.8} color={colors.textSubtle} style={styles.padded}>Independent sellers — not the official store.</Text>
            <ProductMasonry products={products.data!.otherSellersProducts} />
          </View>
        ) : null}

        {(posts.data?.data.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <Text size={16} weight={600} lineHeight={19.2} style={styles.padded}>Posts</Text>
            {posts.data!.data.slice(0, 3).map((post) => (
              <PostCard key={post.id} post={post} onPress={() => navigation.navigate("PostDetail", { postId: post.id })} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40, gap: 12 },
  cover: { marginHorizontal: 12, height: 110, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  identity: { paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.placeholder },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  padded: { paddingHorizontal: 12 },
  actions: { flexDirection: "row", gap: 8 },
  section: { gap: 8, marginTop: 12 },
  sectionTitle: { paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));
