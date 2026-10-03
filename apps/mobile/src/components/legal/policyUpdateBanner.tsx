import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Cancel20Icon, Shield24Icon } from "@/components/icons";
import { buildModalElevation, buildModalPalette, buildModalToneColors, modalMotion, modalRadius } from "@/components/ui/modalChrome.constant";
import { Text } from "@/components/ui/text";
import { usePolicyUpdates } from "@/hooks/usePolicyUpdates.hook";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { usePolicyUpdateStore } from "@/store/policyUpdate.store";
import { makeThemedStyles, useTheme } from "@/theme";

import { formatPolicyEffectiveDate, joinPolicyTitles } from "./policyHighlights.util";
import { PolicyWhatChangedSheet } from "./policyWhatChangedSheet";

export function PolicyUpdateBanner() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();
  const { isSignedIn, bannerVersions } = usePolicyUpdates();
  const dismissPolicyBanner = usePolicyUpdateStore((state) => state.dismissPolicyBanner);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const first = bannerVersions[0];
  if (!isSignedIn || !first) return null;
  const brand = buildModalToneColors(colors, scheme, "brand");
  const palette = buildModalPalette(colors, scheme);
  const earliestEffective = [...bannerVersions].sort((left, right) => Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt))[0] ?? first;
  const dismiss = () => dismissPolicyBanner(bannerVersions.map((version) => version.policyVersionId));
  return (
    <>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInUp.duration(modalMotion.enterMs)}
        style={[styles.banner, { top: insets.top + 8 }]}
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.iconBadge, { backgroundColor: brand.tint }]}>
          <Shield24Icon size={18} color={brand.ink} />
        </View>
        <View style={styles.message}>
          <Text size={14} weight={600} lineHeight={19} maxFontSizeMultiplier={1.8}>
            We've updated our {joinPolicyTitles(bannerVersions)}
          </Text>
          <Text size={12} lineHeight={16} color={colors.textMuted} maxFontSizeMultiplier={1.8}>
            Effective {formatPolicyEffectiveDate(earliestEffective.effectiveAt)}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setIsSheetOpen(true)} style={({ pressed }) => [styles.review, pressed ? { opacity: 0.7 } : null]}>
            <Text size={13} weight={600} lineHeight={18} color={palette.link} maxFontSizeMultiplier={1.8}>Review changes</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss this notice" hitSlop={10} onPress={dismiss} style={styles.dismiss}>
          <Cancel20Icon size={16} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
      <PolicyWhatChangedSheet visible={isSheetOpen} versions={bannerVersions} onClose={() => setIsSheetOpen(false)} onDismissBanner={dismiss} />
    </>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    banner: {
      position: "absolute",
      left: 12,
      right: 12,
      zIndex: 50,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderRadius: modalRadius.card + 2,
      backgroundColor: palette.surface,
      ...buildModalElevation(scheme, palette),
    },
    iconBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    message: { flex: 1, gap: 2 },
    review: { alignSelf: "flex-start", marginTop: 6, paddingVertical: 2 },
    dismiss: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.inset },
  });
});
