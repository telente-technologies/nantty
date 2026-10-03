import { useEffect, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";

import { FrameAwareModal } from "./frameAwareModal";
import { ModalActionStack, type ModalAction } from "./modalActions";
import { buildModalElevation, buildModalPalette, buildModalToneColors, modalMaxWidth, modalMotion, modalRadius, modalSpacing, type ModalTone } from "./modalChrome.constant";
import { Text } from "./text";

export interface DialogProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly message?: string;
  readonly icon?: ReactNode;
  readonly illustration?: ReactNode;
  readonly tone?: ModalTone;
  readonly actions?: readonly ModalAction[];
  readonly dismissible?: boolean;
  readonly children?: ReactNode;
}

function DialogCard({ title, message, icon, illustration, tone = "neutral", actions = [], children }: Omit<DialogProps, "visible" | "onClose" | "dismissible">) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const frame = useSafeAreaFrame();
  const reduceMotion = useReducedMotionPreference();
  const toneColors = buildModalToneColors(colors, scheme, tone);
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: reduceMotion ? 0 : modalMotion.enterMs, easing: Easing.out(Easing.cubic) });
  }, [appear, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ scale: 0.95 + appear.value * 0.05 }] }));
  return (
    <Animated.View style={[styles.card, animatedStyle]} accessibilityViewIsModal>
      <ScrollView style={{ maxHeight: frame.height * 0.62 }} contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
        {icon && !illustration ? <View style={[styles.iconBadge, { backgroundColor: toneColors.tint }]}>{icon}</View> : null}
        <Text size={18} weight={600} lineHeight={24} align="center" accessibilityRole="header" maxFontSizeMultiplier={1.8}>
          {title}
        </Text>
        {message ? (
          <Text size={14} lineHeight={20} align="center" color={colors.textMuted} maxFontSizeMultiplier={1.8} style={styles.message}>
            {message}
          </Text>
        ) : null}
        {children ? <View style={styles.children}>{children}</View> : null}
      </ScrollView>
      <ModalActionStack actions={actions} style={styles.actions} />
    </Animated.View>
  );
}

export function Dialog({ visible, onClose, dismissible = true, ...cardProps }: DialogProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotionPreference();
  const closeIfDismissible = () => {
    if (dismissible) onClose();
  };
  return (
    <FrameAwareModal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={closeIfDismissible} statusBarTranslucent>
      <View style={styles.centre}>
        <Pressable
          style={styles.scrim}
          onPress={closeIfDismissible}
          accessibilityLabel={dismissible ? "Close dialog" : undefined}
          accessible={dismissible}
          importantForAccessibility={dismissible ? "auto" : "no-hide-descendants"}
        />
        <DialogCard {...cardProps} />
      </View>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => {
  const palette = buildModalPalette(colors, scheme);
  return StyleSheet.create({
    centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: palette.scrim },
    card: {
      width: "100%",
      maxWidth: modalMaxWidth,
      backgroundColor: palette.surface,
      borderRadius: modalRadius.dialog,
      paddingTop: 24,
      paddingBottom: modalSpacing.edge,
      ...buildModalElevation(scheme, palette),
    },
    scrollContent: { paddingHorizontal: modalSpacing.edge, alignItems: "stretch" },
    illustration: { alignItems: "center", marginBottom: 16 },
    iconBadge: { alignSelf: "center", width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    message: { marginTop: 8 },
    children: { marginTop: 16 },
    actions: { marginTop: 20, paddingHorizontal: modalSpacing.edge },
  });
});
