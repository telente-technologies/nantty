import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProductMasonry } from "@/components/home/productMasonry";
import { BrandRow } from "@/components/store/brandRow";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { ProductSummary } from "@/types";
import type { SearchItem, SearchOrderItem, SearchPostItem } from "@/types/search.type";
import { orderStatusLabel } from "@/components/seller/orderStatusPill";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { PersonRow } from "./personRow";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

export interface SearchResultHandlers {
  readonly onOpenUser: (userId: string) => void;
  readonly onOpenStore: (storeId: string) => void;
  readonly onOpenBrand: (brandId: string) => void;
  readonly onOpenPost: (item: SearchPostItem) => void;
  readonly onOpenCategory: (categoryId: string, name: string) => void;
  readonly onSearchHashtag: (tag: string) => void;
  readonly onOpenOrder?: (orderId: string) => void;
}

type ItemOf<T extends SearchItem["type"]> = SearchItem & { readonly type: T };

const pick = <T extends SearchItem["type"]>(items: readonly SearchItem[], type: T) => items.filter((item): item is ItemOf<T> => item.type === type);

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.textMuted} style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PostRow({ item, onPress }: { readonly item: SearchPostItem; readonly onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={item.caption || (item.type === "clip" ? "Clip" : "Post")} onPress={onPress} style={styles.postRow}>
      <Image source={item.thumbnailUrl ? { uri: item.thumbnailUrl } : null} style={[styles.thumb, { backgroundColor: colors.placeholder }]} contentFit="cover" />
      <View style={styles.postText}>
        <Text size={typeScale.md} numberOfLines={2}>{item.caption || (item.type === "clip" ? "Clip" : "Post")}</Text>
        <Text size={typeScale.xs} color={colors.textSubtle}>{item.likes} likes · {item.views} views</Text>
      </View>
    </Pressable>
  );
}

function OrderRow({ item, onPress }: { readonly item: SearchOrderItem; readonly onPress: () => void }) {
  const { colors } = useTheme();
  const status = orderStatusLabel(item.status);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Order ${item.reference}, ${item.buyerName}, ${status}`} onPress={onPress} style={styles.textRow}>
      <View style={styles.orderTop}>
        <Text size={typeScale.md} weight={500}>#{item.reference}</Text>
        <Text size={typeScale.md} weight={500}>{formatMoneyForDisplay(item.total)}</Text>
      </View>
      <Text size={typeScale.xs} color={colors.textSubtle} numberOfLines={1}>{item.buyerName} · {status} · {item.itemSummary}</Text>
    </Pressable>
  );
}

export function SearchResultSections({ items, handlers }: { readonly items: readonly SearchItem[]; readonly handlers: SearchResultHandlers }) {
  const { colors } = useTheme();
  const people = pick(items, "user");
  const stores = pick(items, "store");
  const brands = pick(items, "brand");
  const products: ProductSummary[] = pick(items, "product").map(({ type: _type, ...product }) => product);
  const posts = pick(items, "post");
  const clips = pick(items, "clip");
  const hashtags = pick(items, "hashtag");
  const categories = pick(items, "category");
  const orders = pick(items, "order");
  return (
    <View style={styles.root}>
      {people.length > 0 ? (
        <Section title="People">
          {people.map((person) => <PersonRow key={person.id} name={person.name} handle={`@${person.username}`} avatarUrl={person.avatarUrl} verified={person.verified} onPress={() => handlers.onOpenUser(person.id)} />)}
        </Section>
      ) : null}
      {stores.length > 0 ? (
        <Section title="Stores">
          {stores.map((store) => <PersonRow key={store.id} name={store.name} handle={`${store.rating.toFixed(1)} rating · ${store.reviewCount} reviews`} avatarUrl={store.logoUrl} onPress={() => handlers.onOpenStore(store.id)} />)}
        </Section>
      ) : null}
      {brands.length > 0 ? (
        <Section title="Brands">
          {brands.map((brand) => <BrandRow key={brand.id} brand={brand} onPress={() => handlers.onOpenBrand(brand.id)} />)}
        </Section>
      ) : null}
      {categories.length > 0 ? (
        <Section title="Categories">
          {categories.map((category) => (
            <Pressable key={category.id} accessibilityRole="button" onPress={() => handlers.onOpenCategory(category.id, category.name)} style={styles.textRow}>
              <Text size={typeScale.md}>{category.name}</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
      {orders.length > 0 && handlers.onOpenOrder ? (
        <Section title="Orders">{orders.map((order) => <OrderRow key={order.id} item={order} onPress={() => handlers.onOpenOrder?.(order.id)} />)}</Section>
      ) : null}
      {posts.length > 0 ? <Section title="Posts">{posts.map((post) => <PostRow key={post.id} item={post} onPress={() => handlers.onOpenPost(post)} />)}</Section> : null}
      {clips.length > 0 ? <Section title="Clips">{clips.map((clip) => <PostRow key={clip.id} item={clip} onPress={() => handlers.onOpenPost(clip)} />)}</Section> : null}
      {hashtags.length > 0 ? (
        <Section title="Hashtags">
          {hashtags.map((hashtag) => (
            <Pressable key={hashtag.id} accessibilityRole="button" onPress={() => handlers.onSearchHashtag(hashtag.tag)} style={styles.textRow}>
              <Text size={typeScale.md} weight={500}>#{hashtag.tag}</Text>
              <Text size={typeScale.xs} color={colors.textSubtle}>{hashtag.postCount} posts</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
      {products.length > 0 ? (
        <View>
          <Text size={typeScale.sm} weight={500} lineHeight={16.9} color={colors.textMuted} style={styles.productsTitle}>Products</Text>
          <ProductMasonry products={products} adPlacement="search" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[5] },
  section: { paddingHorizontal: spacing[4], gap: spacing[1] },
  sectionTitle: { marginBottom: spacing[1] },
  postRow: { flexDirection: "row", gap: spacing[3], paddingVertical: 6, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: 6 },
  postText: { flex: 1, gap: 2 },
  textRow: { paddingVertical: spacing[2], gap: 2 },
  orderTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing[2] },
  productsTitle: { marginBottom: spacing[2], paddingHorizontal: spacing[4] },
});
