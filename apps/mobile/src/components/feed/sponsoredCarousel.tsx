import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRef } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ViewToken } from "react-native";

import { Text } from "@/components/ui/text";
import { adEventsService } from "@/services/ads/adEvents.service";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AdCard, AdPlacement, ID, SponsoredPlacement } from "@/types";

const CARD_WIDTH_RATIO = 0.72;
const CARD_GAP = 8;
const SIDE_PADDING = 16;

interface SponsoredCarouselProps {
  readonly sponsored: SponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
}

export function SponsoredCarousel({ sponsored, placement, itemId }: SponsoredCarouselProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const cards = sponsored.cards ?? [];
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const token of viewableItems) {
      if (token.isViewable && typeof token.index === "number") adEventsService.recordSponsoredCardViewOncePerSession(sponsored, placement, itemId, token.index);
    }
  }).current;
  const openCard = (index: number) => openSponsoredTarget({ sponsored, placement, itemId, target: { kind: "card", index }, navigation });
  const renderCard = ({ item, index }: { item: AdCard; index: number }) => (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Card ${index + 1} of ${cards.length}: ${item.headline}. ${item.ctaLabel ?? "Learn more"}`}
      onPress={() => openCard(index)}
      style={[styles.card, { width: cardWidth }]}
    >
      <Image source={{ uri: item.media.kind === "video" ? (item.media.posterUrl ?? item.media.url) : item.media.url }} style={styles.media} contentFit="cover" />
      <View style={styles.text}>
        <Text size={14} weight={600} lineHeight={18} numberOfLines={2}>
          {item.headline}
        </Text>
        {item.description ? (
          <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.cta}>
        <Text size={13} weight={600} lineHeight={16} color={colors.white}>
          {item.ctaLabel ?? "Learn more"}
        </Text>
      </View>
    </Pressable>
  );
  return (
    <FlatList
      horizontal
      data={cards}
      renderItem={renderCard}
      keyExtractor={(card, index) => `${index}:${card.headline}`}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + CARD_GAP}
      decelerationRate="fast"
      nestedScrollEnabled
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      onViewableItemsChanged={onViewableItemsChanged}
      accessibilityLabel={`Carousel of ${cards.length} ads`}
    />
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    content: { paddingHorizontal: SIDE_PADDING },
    card: { borderRadius: 12, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, backgroundColor: colors.surface },
    media: { width: "100%", aspectRatio: 1, backgroundColor: colors.media },
    text: { gap: 2, paddingHorizontal: 10, paddingTop: 8 },
    cta: { margin: 10, height: 32, borderRadius: 4, backgroundColor: colors.primarySolid, alignItems: "center", justifyContent: "center" },
  }),
);
