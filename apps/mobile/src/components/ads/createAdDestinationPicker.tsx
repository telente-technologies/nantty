import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { usersService } from "@/services/account/users.service";
import { sellerService } from "@/services/sellers/seller.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostDestinationType } from "@/types/boost.type";
import type { CreateAdDestination } from "@/utils/adsHub.util";

export interface CreateAdDestinationPickerProps {
  readonly signedInUserId: string;
  readonly storeId: string | null;
  readonly destination: CreateAdDestination | null;
  readonly destinationType: BoostDestinationType | null;
  readonly onChooseType: (type: BoostDestinationType) => void;
  readonly onChooseDestination: (destination: CreateAdDestination) => void;
}

const TYPE_ROWS: readonly { readonly type: BoostDestinationType; readonly label: string; readonly hint: string; readonly needsStore: boolean }[] = [
  { type: "post", label: "A post", hint: "Show one of your posts to more people", needsStore: false },
  { type: "product", label: "A product", hint: "Send shoppers to a product in your store", needsStore: true },
  { type: "store", label: "My store", hint: "Bring shoppers to your store page", needsStore: true },
  { type: "profile", label: "My profile", hint: "Show your profile to people likely to follow you", needsStore: false },
];

export function CreateAdDestinationPicker({ signedInUserId, storeId, destination, destinationType, onChooseType, onChooseDestination }: CreateAdDestinationPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const choose = (type: BoostDestinationType) => {
    onChooseType(type);
    if (type === "profile") onChooseDestination({ type, targetId: signedInUserId, label: "Your profile" });
    if (type === "store" && storeId) onChooseDestination({ type, targetId: storeId, label: "Your store" });
  };
  return (
    <View style={styles.root}>
      {TYPE_ROWS.filter((row) => !row.needsStore || storeId).map((row) => (
        <SelectableRow key={row.type} selected={destinationType === row.type} onPress={() => choose(row.type)} accessibilityLabel={`Promote ${row.label.toLowerCase()}. ${row.hint}`}>
          <Text size={14} weight={500} lineHeight={16.8}>{row.label}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>{row.hint}</Text>
        </SelectableRow>
      ))}
      {!storeId ? <Text size={12} lineHeight={16.8} color={colors.textMuted}>Products and stores appear here when you own or manage a store.</Text> : null}
      {destinationType === "post" ? <MyPostsList userId={signedInUserId} selectedId={destination?.type === "post" ? destination.targetId : null} onChoose={onChooseDestination} /> : null}
      {destinationType === "product" ? <MyProductsList selectedId={destination?.type === "product" ? destination.targetId : null} onChoose={onChooseDestination} /> : null}
    </View>
  );
}

function MyPostsList({ userId, selectedId, onChoose }: { readonly userId: string; readonly selectedId: string | null; readonly onChoose: (destination: CreateAdDestination) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const posts = useQuery({ queryKey: ["ads", "promotablePosts", userId], queryFn: () => usersService.fetchPostsByUserId(userId) });
  if (posts.isPending) return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your posts" />;
  if (posts.isError) return <ErrorState error={posts.error} message="Couldn't load your posts." variant="inline" onRetry={() => posts.refetch()} />;
  const items = posts.data.data;
  if (items.length === 0) return <Text size={13} lineHeight={16.9} color={colors.textMuted}>You haven't posted anything yet. Create a post first, then promote it.</Text>;
  return (
    <View style={styles.list}>
      <Text size={13} weight={600} lineHeight={16.9}>Choose a post</Text>
      {items.map((post) => {
        const thumbnail = post.media[0]?.posterUrl ?? post.media[0]?.url ?? null;
        const label = post.text.trim() || (post.media.length > 0 ? "Photo or video post" : "Post");
        return (
          <SelectableRow key={post.id} selected={selectedId === post.id} onPress={() => onChoose({ type: "post", targetId: post.id, label })} accessibilityLabel={`Post: ${label}`}>
            <View style={styles.itemRow}>
              {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
              <Text size={13} lineHeight={16.9} numberOfLines={2} style={styles.flex}>{label}</Text>
            </View>
          </SelectableRow>
        );
      })}
    </View>
  );
}

function MyProductsList({ selectedId, onChoose }: { readonly selectedId: string | null; readonly onChoose: (destination: CreateAdDestination) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const products = useQuery({ queryKey: ["ads", "promotableProducts"], queryFn: sellerService.listMyStoreProducts });
  if (products.isPending) return <ActivityIndicator color={colors.primary} accessibilityLabel="Loading your products" />;
  if (products.isError) return <ErrorState error={products.error} message="Couldn't load your products." variant="inline" onRetry={() => products.refetch()} />;
  const items = products.data.filter((product) => product.status === "active");
  if (items.length === 0) return <Text size={13} lineHeight={16.9} color={colors.textMuted}>Publish a product in your store first, then promote it.</Text>;
  return (
    <View style={styles.list}>
      <Text size={13} weight={600} lineHeight={16.9}>Choose a product</Text>
      {items.map((product) => (
        <SelectableRow key={product.id} selected={selectedId === product.id} onPress={() => onChoose({ type: "product", targetId: product.id, label: product.name })} accessibilityLabel={`Product: ${product.name}`}>
          <View style={styles.itemRow}>
            {product.images[0]?.url ? <Image source={{ uri: product.images[0].url }} style={styles.thumbnail} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
            <Text size={13} lineHeight={16.9} numberOfLines={2} style={styles.flex}>{product.name}</Text>
          </View>
        </SelectableRow>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  list: { gap: 8, marginTop: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumbnail: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.skeleton },
  flex: { flex: 1 },
}));
