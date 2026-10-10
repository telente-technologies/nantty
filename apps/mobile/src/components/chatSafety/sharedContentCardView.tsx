import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { buildInternalRoute } from "@/components/chat/chatLinks.util";
import { requireAuthThen } from "@/utils/requireAuth.util";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { chatSafetyService } from "@/services/chat/chatSafety.service";
import { followsService } from "@/services/social/follows.service";
import type { SharedContentCard, SharedContentReference } from "@/types";

export interface SharedContentCardViewProps {
  readonly reference: SharedContentReference;
  readonly snapshot?: SharedContentCard | null;
}

export function SharedContentCardView({ reference, snapshot }: SharedContentCardViewProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const queryKey = ["shared-content", reference.kind, reference.id];
  const { data: card } = useQuery({
    queryKey,
    queryFn: () => chatSafetyService.resolveSharedContent(reference),
    placeholderData: snapshot ?? undefined,
  });
  const follow = useMutation({
    mutationFn: () => followsService.followUser(card?.profileUserId ?? reference.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  if (!card) return <View style={[styles.card, styles.loading]} accessibilityLabel="Loading preview" />;
  const isAvailable = card.availability === "available";
  const openInApp = () => {
    const route = buildInternalRoute(reference, card.profileUserId);
    (navigation.navigate as (name: string, params: object) => void)(route.name, route.params);
  };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${card.title}${card.subtitle ? `, ${card.subtitle}` : ""}`} disabled={!isAvailable} onPress={openInApp} style={styles.card}>
      {isAvailable && card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={reference.kind === "profile" ? styles.avatar : styles.image} contentFit="cover" /> : null}
      <View style={styles.body}>
        {card.isLive ? (
          <View style={styles.liveRow}>
            <View style={styles.liveBadge}><Text size={10} weight={700} lineHeight={12} color={colors.white}>LIVE</Text></View>
            <Text size={11} lineHeight={14} color={colors.textMuted}>{(card.viewerCount ?? 0).toLocaleString("en-US")} watching</Text>
          </View>
        ) : null}
        <Text size={13} weight={600} lineHeight={17} numberOfLines={2} color={isAvailable ? colors.text : colors.textMuted}>{card.title}</Text>
        {isAvailable && card.subtitle ? <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>{card.subtitle}</Text> : null}
        {card.priceLabel ? (
          <Text size={13} weight={600} lineHeight={17} color={colors.primary}>
            {card.priceLabel}{typeof card.stock === "number" ? (card.stock > 0 ? ` · ${card.stock} in stock` : " · Out of stock") : ""}
          </Text>
        ) : null}
        {isAvailable && reference.kind === "profile" && card.followsAuthor === false ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Follow ${card.title}`} onPress={() => requireAuthThen(() => follow.mutate(), undefined, "follow people")} style={styles.followButton}>
            <Text size={12} weight={600} lineHeight={16} color={colors.white}>{follow.isPending ? "Following…" : "Follow"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { width: 240, borderRadius: 12, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  loading: { height: 72, backgroundColor: colors.skeleton },
  image: { width: "100%", height: 120 },
  avatar: { width: 64, height: 64, borderRadius: 32, margin: 10 },
  body: { padding: 10, gap: 3 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveBadge: { backgroundColor: colors.error, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  followButton: { alignSelf: "flex-start", marginTop: 4, backgroundColor: colors.primarySolid, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
}));
