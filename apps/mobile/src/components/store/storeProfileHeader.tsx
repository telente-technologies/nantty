import { MentionText } from "@/components/mentions/mentionText";
import { EarnBackLine } from "@/components/store/earnBackLine";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { CalendarDots16Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";

import { OfficialStoreBadge } from "./officialStoreBadge";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { StoreDetail } from "@/types/commerce.type";
import { formatCountWithThousandsSuffix, formatJoinedDate } from "@/utils/formatDate.util";
import { PreviewableImage } from "@/components/ui/previewableImage";
import { Star16Icon } from "@/components/icons";
import { IconRow } from "@/components/ui/iconRow";

export interface StoreProfileHeaderProps {
  readonly store: StoreDetail;
  readonly onToggleFollow: () => void;
  readonly onMessage: () => void;
}

function OutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.outlineButton}>
      <Text size={14} lineHeight={16.8}>{title}</Text>
    </Pressable>
  );
}

export function StoreProfileHeader({ store, onToggleFollow, onMessage }: StoreProfileHeaderProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.banner}>
        {store.bannerUrl ? (
          <PreviewableImage imageUrl={store.bannerUrl} accessibilityLabel={`View ${store.name} cover photo`} style={StyleSheet.absoluteFill}>
            <Image source={{ uri: store.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </PreviewableImage>
        ) : null}
      </View>
      <View style={styles.identity}>
        <View style={styles.logo}>
          {store.logoUrl ? (
            <PreviewableImage imageUrl={store.logoUrl} accessibilityLabel={`View ${store.name} logo`} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: store.logoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </PreviewableImage>
          ) : null}
        </View>
        <View style={styles.names}>
          <View style={styles.nameRow}>
            <Text size={16} weight={500} lineHeight={19.2} accessibilityRole="header">{store.name}</Text>
            <VerificationBadge verification={store.verification} legacyVerified={store.verified} size={20} />
          </View>
          <Text size={14} lineHeight={16.8} color={colors.textSubtle}>@{store.handle}</Text>
          {store.officialBrand ? <OfficialStoreBadge /> : null}
          <View style={styles.stats}>
            <Text size={14} weight={500} lineHeight={16.8}>
              {formatCountWithThousandsSuffix(store.followers)} <Text size={14} lineHeight={16.8}>followers</Text>
            </Text>
            <IconRow icon={<Star16Icon size={14} />} gap={4}>
              <Text size={14} weight={500} lineHeight={16.8} accessibilityLabel={`Rated ${store.rating.toFixed(1)} from ${store.reviewCount} reviews`}>
                {store.rating.toFixed(1)} <Text size={14} lineHeight={16.8}>({store.reviewCount})</Text>
              </Text>
            </IconRow>
          </View>
        </View>
      </View>
      <View style={styles.about}>
        <MentionText text={store.bio} size={13} lineHeight={16.9} />
        <EarnBackLine basisPoints={store.earnBackBasisPoints} />
        <View style={styles.joined}>
          <CalendarDots16Icon />
          <Text size={13} lineHeight={16.9}>{formatJoinedDate(store.joinedAt)}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <OutlineButton title={store.isFollowing ? "Following" : "Follow"} onPress={onToggleFollow} />
        <OutlineButton title="Message" onPress={onMessage} />
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  banner: { marginHorizontal: 12, height: 100, borderRadius: 8, backgroundColor: scheme === "dark" ? colors.placeholder : "#C4C4C4", overflow: "hidden" },
  identity: { marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
  names: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stats: { flexDirection: "row", gap: 8 },
  about: { marginTop: 15, paddingHorizontal: 12, gap: 8 },
  joined: { flexDirection: "row", alignItems: "center", gap: 4 },
  buttons: { marginTop: 19, paddingHorizontal: 12, flexDirection: "row", gap: 8 },
  outlineButton: {
    flex: 1,
    height: 37,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
}));
