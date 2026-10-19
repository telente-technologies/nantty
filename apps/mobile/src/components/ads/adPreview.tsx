import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { PostCard } from "@/components/feed/postCard";
import { PromotedEntityAdCard } from "@/components/feed/promotedEntityAdCard";
import { SponsoredLabel } from "@/components/feed/sponsoredContent";
import { ProductCard } from "@/components/product/productCard";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { postsService } from "@/services/content/posts.service";
import { sellerService } from "@/services/sellers/seller.service";
import { storesService } from "@/services/sellers/stores.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ProductSummary, SponsoredPlacement } from "@/types";
import type { CatalogProduct } from "@/types/sellerCatalog.type";
import type { CreateAdDestination } from "@/utils/adsHub.util";

const PREVIEW_CAMPAIGN_ID = "ad-preview";

export function adPreviewProductSummary(product: CatalogProduct): ProductSummary | null {
  const price = product.variants[0]?.price;
  if (!price) return null;
  return { id: product.id, name: product.name, price, imageUrl: product.images[0]?.url ?? null, hasVariants: product.variants.length > 1, sponsored: null };
}

export function AdPreview({ destination }: { readonly destination: CreateAdDestination }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <Text size={12} lineHeight={16} color={colors.textMuted}>Preview: this is how your ad looks in the feed. Taps are turned off here.</Text>
      <View pointerEvents="none" accessible accessibilityLabel="Preview of your ad in the feed" style={styles.frame}>
        {destination.type === "post" ? <PostPreview postId={destination.targetId} /> : null}
        {destination.type === "store" || destination.type === "profile" ? <EntityPreview kind={destination.type} id={destination.targetId} /> : null}
        {destination.type === "product" ? <ProductPreview productId={destination.targetId} /> : null}
      </View>
    </View>
  );
}

function PreviewLoading({ query, label }: { readonly query: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }; readonly label: string }) {
  const { colors } = useTheme();
  if (query.isError) return <ErrorState error={query.error} message={`Couldn't load the preview of your ${label}.`} variant="inline" onRetry={() => query.refetch()} />;
  return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading preview" />;
}

function PostPreview({ postId }: { readonly postId: string }) {
  const post = useQuery({ queryKey: ["ads", "preview", "post", postId], queryFn: () => postsService.fetchPostById(postId) });
  if (!post.data) return <PreviewLoading query={post} label="post" />;
  const sponsored: SponsoredPlacement = { campaignId: PREVIEW_CAMPAIGN_ID, label: "Boosted", advertiserName: post.data.author.name };
  return <PostCard post={{ ...post.data, sponsored }} />;
}

function EntityPreview({ kind, id }: { readonly kind: "store" | "profile"; readonly id: string }) {
  const user = useAuthStore((state) => state.user);
  const store = useQuery({ queryKey: ["stores", id], queryFn: () => storesService.fetchStoreById(id), enabled: kind === "store" });
  if (kind === "store" && !store.data) return <PreviewLoading query={store} label="store" />;
  const promoted = kind === "store" && store.data
    ? { kind, id, name: store.data.name, handle: store.data.handle, avatarUrl: store.data.logoUrl, verified: store.data.verified, private: false }
    : { kind, id, name: user?.name ?? "", handle: user?.username ?? "", avatarUrl: user?.avatarUrl ?? null, verified: user?.verified ?? false, private: Boolean(user?.isPrivate) };
  return <PromotedEntityAdCard sponsored={{ campaignId: PREVIEW_CAMPAIGN_ID, label: "Sponsored", advertiserName: promoted.name, promoted }} placement="feed" itemId={`preview-${id}`} media={[]} primaryText="" />;
}

function ProductPreview({ productId }: { readonly productId: string }) {
  const styles = useStyles();
  const product = useQuery({ queryKey: ["ads", "preview", "product", productId], queryFn: () => sellerService.fetchStoreProductById(productId) });
  if (!product.data) return <PreviewLoading query={product} label="product" />;
  const summary = adPreviewProductSummary(product.data);
  if (!summary) return <Text size={13}>Add a price to this product to preview it.</Text>;
  return (
    <View style={styles.product}>
      <SponsoredLabel sponsored={{ campaignId: PREVIEW_CAMPAIGN_ID, label: "Sponsored", advertiserName: product.data.name }} />
      <ProductCard product={summary} variant="grid" />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  frame: { borderRadius: 12, borderWidth: 1, borderColor: colors.divider, overflow: "hidden", backgroundColor: colors.background, paddingVertical: 8 },
  product: { paddingHorizontal: 16, gap: 6 },
}));
