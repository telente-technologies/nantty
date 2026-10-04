import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { EyeClosed20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { useSensitiveConsentStore } from "@/store/sensitiveConsent.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { SensitiveContent } from "@/types/postAudience.type";
import { decideSensitiveInterstitialState, describeSensitiveLabels } from "@/utils/sensitiveContent.util";

export interface SensitiveContentGateProps {
  readonly postId: string;
  readonly sensitive: SensitiveContent | null | undefined;
  readonly blurredPreviewUrl?: string | null;
  readonly minimumHeight?: number;
  readonly children: ReactNode;
}

export function SensitiveContentGate({ postId, sensitive, blurredPreviewUrl, minimumHeight = 220, children }: SensitiveContentGateProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const hasConsented = useSensitiveConsentStore((state) => state.consentedPostIds.includes(postId));
  const rememberConsentForPost = useSensitiveConsentStore((state) => state.rememberConsentForPost);
  const state = decideSensitiveInterstitialState(sensitive, hasConsented);
  if (state !== "covered" || !sensitive) return <>{children}</>;
  const description = describeSensitiveLabels(sensitive.labels);
  return (
    <View style={[styles.cover, { minHeight: minimumHeight }]} accessibilityRole="summary" accessibilityLabel={`Sensitive content. ${description}`}>
      {blurredPreviewUrl ? <Image source={{ uri: blurredPreviewUrl }} blurRadius={60} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.dim} pointerEvents="none" />
      <View style={styles.iconBadge}>
        <EyeClosed20Icon size={22} color={colors.white} />
      </View>
      <Text size={16} weight={600} lineHeight={20} color={colors.white} align="center" accessibilityRole="header">
        Sensitive content
      </Text>
      <Text size={13} lineHeight={18} color={colors.white} align="center" style={styles.message} maxFontSizeMultiplier={1.6}>
        {description} You can choose whether to see it.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View sensitive content"
        accessibilityHint="Shows this post. Your choice is remembered for this post."
        onPress={() => rememberConsentForPost(postId)}
        style={({ pressed }) => [styles.viewButton, pressed ? styles.pressed : null]}
        hitSlop={8}
      >
        <Text size={14} weight={600} lineHeight={18} color={colors.black}>
          View
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  cover: { backgroundColor: colors.media, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32, paddingVertical: 28, overflow: "hidden" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.62)" },
  iconBadge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  message: { maxWidth: 300 },
  viewButton: { marginTop: 6, minWidth: 96, height: 40, paddingHorizontal: 20, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  pressed: { opacity: 0.85 },
}));
