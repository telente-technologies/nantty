import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { SealCheck20Icon, Star16Icon } from "@/components/icons";
import { useFollowUserToggle } from "@/components/profile/confirmedFollowToggle.hook";
import { followButtonLabelForState, resolveFollowStateOfUser } from "@/components/profile/followState.util";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { VERIFICATION_BADGE_COLORS } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { usersService } from "@/services/account/users.service";
import { openSponsoredTarget } from "@/services/ads/adClick.service";
import { storesService } from "@/services/sellers/stores.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { AdPlacement, AdPromotedEntity, AdTapTarget, ID, Media, Verification } from "@/types";
import { formatCompactCount } from "@/utils/formatCount.util";
import { promotedCheckmarkColor, promotedEntityCallToActionLabel, promotedEntityThumbnails, type PromotedEntitySponsoredPlacement } from "@/utils/promotedEntityAd.util";
import { requireAuthThen } from "@/utils/requireAuth.util";

import { SponsoredLabel } from "./sponsoredContent";

export interface PromotedEntityAdCardProps {
  readonly sponsored: PromotedEntitySponsoredPlacement;
  readonly placement: AdPlacement;
  readonly itemId: ID;
  readonly media: readonly Media[];
  readonly primaryText: string;
}

interface PromotedEntityDetails {
  readonly subtitle: string;
  readonly ratingLabel: string | null;
  readonly bio: string;
  readonly followersLabel: string | null;
  readonly thumbnails: readonly string[];
  readonly verification: Verification | null | undefined;
}

function usePromotedStoreDetails(promoted: AdPromotedEntity, enabled: boolean): PromotedEntityDetails | null {
  const store = useQuery({ queryKey: ["stores", promoted.id], queryFn: () => storesService.fetchStoreById(promoted.id), enabled, staleTime: 5 * 60_000 });
  const products = useQuery({ queryKey: ["products", "store", promoted.id], queryFn: () => storesService.fetchStoreProducts(promoted.id), enabled, staleTime: 5 * 60_000 });
  if (!enabled) return null;
  const detail = store.data;
  return {
    subtitle: `@${detail?.handle ?? promoted.handle}`,
    ratingLabel: detail && detail.ratingCount > 0 ? `${detail.rating.toFixed(1)} (${formatCompactCount(detail.ratingCount)})` : null,
    bio: detail?.bio ?? "",
    followersLabel: detail ? `${formatCompactCount(detail.followers)} followers` : null,
    thumbnails: promotedEntityThumbnails(products.data ?? [], detail?.bannerUrl ?? null),
    verification: detail?.verification,
  };
}

function usePromotedProfileDetails(promoted: AdPromotedEntity, enabled: boolean) {
  const profile = useQuery({ queryKey: profileQueryKeys.userProfile(promoted.id), queryFn: () => usersService.fetchUserProfileById(promoted.id), enabled, staleTime: 60_000 });
  if (!enabled) return { details: null, user: undefined };
  const user = profile.data;
  const details: PromotedEntityDetails = {
    subtitle: `@${user?.username ?? promoted.handle}`,
    ratingLabel: null,
    bio: user?.bio ?? "",
    followersLabel: user ? `${formatCompactCount(user.followers)} followers` : null,
    thumbnails: [],
    verification: user?.verification,
  };
  return { details, user };
}

export function PromotedEntityAdCard({ sponsored, placement, itemId, media, primaryText }: PromotedEntityAdCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { promoted } = sponsored;
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const isStore = promoted.kind === "store";
  const storeDetails = usePromotedStoreDetails(promoted, isStore);
  const { details: profileDetails, user } = usePromotedProfileDetails(promoted, !isStore);
  const details = storeDetails ?? profileDetails;
  const { toggleUser } = useFollowUserToggle();
  const followState = user ? resolveFollowStateOfUser(user) : "none";
  const showsFollow = !isStore && promoted.id !== signedInUserId && followState !== "accepted" && followState !== "blocked";
  const cover = media[0]?.posterUrl ?? media[0]?.url ?? null;
  const open = (target: AdTapTarget) => void openSponsoredTarget({ sponsored, placement, itemId, target, navigation });
  const follow = () => requireAuthThen(() => toggleUser({ id: promoted.id, username: user?.username ?? promoted.handle, followState, isPrivate: user?.isPrivate ?? promoted.private }), undefined, "follow people");
  const callToAction = promotedEntityCallToActionLabel(promoted.kind);
  const checkmark = promotedCheckmarkColor(promoted, details?.verification);

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${promoted.name}, ${callToAction}`} onPress={() => open({ kind: "media" })} style={styles.header}>
        <Avatar uri={promoted.avatarUrl} size={40} />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text size={14} weight={600} lineHeight={16.8} numberOfLines={1} style={styles.name}>{promoted.name}</Text>
            {checkmark ? <View accessible accessibilityLabel={checkmark === "gold" ? "Verified business" : checkmark === "black" ? "Official government account" : "Verified account"}><SealCheck20Icon size={16} color={VERIFICATION_BADGE_COLORS[checkmark]} /></View> : null}
            <SponsoredLabel sponsored={sponsored} />
          </View>
          <View style={styles.metaRow}>
            <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>{details?.subtitle ?? `@${promoted.handle}`}</Text>
            {details?.ratingLabel ? (
              <View style={styles.rating} accessible accessibilityLabel={`Rated ${details.ratingLabel}`}>
                <Star16Icon size={12} />
                <Text size={12} lineHeight={16} color={colors.textMuted}>{details.ratingLabel}</Text>
              </View>
            ) : null}
            {details?.followersLabel ? <Text size={12} lineHeight={16} color={colors.textMuted}>{details.followersLabel}</Text> : null}
          </View>
        </View>
      </Pressable>
      {primaryText || details?.bio ? (
        <Text size={14} lineHeight={18.2} numberOfLines={2} style={styles.bio}>{primaryText || details?.bio}</Text>
      ) : null}
      {cover ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${callToAction}, ${promoted.name}`} onPress={() => open({ kind: "media" })}>
          <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
        </Pressable>
      ) : details && details.thumbnails.length > 0 ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${callToAction}, ${promoted.name}`} onPress={() => open({ kind: "media" })} style={styles.thumbnails}>
          {details.thumbnails.map((uri) => <Image key={uri} source={{ uri }} style={styles.thumbnail} contentFit="cover" />)}
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <Button title={callToAction} height={36} style={styles.action} accessibilityLabel={`${callToAction}, ${promoted.name}`} onPress={() => open({ kind: "cta" })} />
        {showsFollow ? (
          <Button variant="subtle" title={followButtonLabelForState(followState)} height={36} style={styles.action} onPress={follow} accessibilityLabel={`${followButtonLabelForState(followState)} ${promoted.name}`} />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider, paddingVertical: 12, gap: 10 },
  header: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rating: { flexDirection: "row", alignItems: "center", gap: 2 },
  bio: { paddingHorizontal: 16 },
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.skeleton },
  thumbnails: { paddingHorizontal: 16, flexDirection: "row", gap: 4 },
  thumbnail: { flex: 1, aspectRatio: 1, borderRadius: 8, backgroundColor: colors.skeleton },
  actions: { paddingHorizontal: 16, flexDirection: "row", gap: 8 },
  action: { flex: 1 },
}));
