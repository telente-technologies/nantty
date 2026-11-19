import { useEffect, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { Cancel20Icon, Warning20Icon } from "@/components/icons";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles, useTheme } from "@/theme";

import { useAccessibilityFocusOnOpen } from "./accessibilityFocus.hook";
import { dismissKeyboardIfVisible, KEYBOARD_DISMISS_ON_DRAG } from "./dismissKeyboardOnEmptyTap.util";
import { FrameAwareModal } from "./frameAwareModal";
import { KeyboardSpacer } from "./keyboardSpacer";
import { ModalActionStack, type ModalAction } from "./modalActions";
import { buildModalElevation, buildModalPalette, buildModalToneColors, modalMaxWidth, modalMotion, modalRadius, modalSpacing, type ModalTone } from "./modalChrome.constant";
import { ModalIntentIcon, modalIntentTone, type ModalIntent } from "./modalIntent";
import { Text } from "./text";

export interface DialogProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly message?: string;
  readonly intent?: ModalIntent;
  readonly icon?: ReactNode;
  readonly illustration?: ReactNode;
  readonly tone?: ModalTone;
  readonly actions?: readonly ModalAction[];
  readonly dismissible?: boolean;
  readonly showCloseButton?: boolean;
  readonly errorMessage?: string | null;
  readonly children?: ReactNode;
}

type DialogCardProps = Omit<DialogProps, "visible" | "dismissible"> & { readonly canClose: boolean };

function DialogCard({ title, message, intent, icon, illustration, tone, actions = [], errorMessage, children, canClose, onClose }: DialogCardProps) {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const frame = useSafeAreaFrame();
  const reduceMotion = useReducedMotionPreference();
  const resolvedTone = tone ?? (intent ? modalIntentTone(intent) : "neutral");
  const toneColors = buildModalToneColors(colors, scheme, resolvedTone);
  const leadingIcon = icon ?? (intent ? <ModalIntentIcon intent={intent} color={toneColors.ink} /> : null);
  const errorInk = buildModalToneColors(colors, scheme, "destructive").ink;
  const titleRef = useAccessibilityFocusOnOpen(true);
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: reduceMotion ? 0 : modalMotion.enterMs, easing: Easing.out(Easing.cubic) });
  }, [appear, reduceMotion]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ scale: 0.95 + appear.value * 0.05 }] }));
  return (
    <Animated.View style={[styles.card, animatedStyle]} accessibilityViewIsModal>
      <ScrollView style={{ maxHeight: frame.height * 0.62 }} contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false} keyboardDismissMode={KEYBOARD_DISMISS_ON_DRAG} keyboardShouldPersistTaps="handled">
        {illustration ? <View style={styles.illustration}>{illustration}</View> : null}
        {leadingIcon && !illustration ? (
          <View style={[styles.iconBadge, { backgroundColor: toneColors.tint }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {leadingIcon}
          </View>
        ) : null}
        <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
          <Text size={18} weight={600} lineHeight={24} align="center" maxFontSizeMultiplier={1.8}>
            {title}
          </Text>
        </View>
        {message ? (
          <Text size={14} lineHeight={20} align="center" color={colors.textMuted} maxFontSizeMultiplier={1.8} style={styles.message}>
            {message}
          </Text>
        ) : null}
        {children ? <View style={styles.children}>{children}</View> : null}
        {errorMessage ? (
          <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Warning20Icon size={16} color={errorInk} />
            <Text size={13} lineHeight={18} color={errorInk} style={styles.errorText} maxFontSizeMultiplier={1.8}>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <ModalActionStack actions={actions} style={styles.actions} />
      {canClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} onPress={onClose} style={({ pressed }) => [styles.close, pressed ? styles.closePressed : null]}>
          <Cancel20Icon size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function Dialog({ visible, onClose, dismissible = true, showCloseButton = true, ...cardProps }: DialogProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotionPreference();
  const isBusy = (cardProps.actions ?? []).some((action) => action.loading);
  const canDismiss = dismissible && !isBusy;
  const closeIfDismissible = () => {
    dismissKeyboardIfVisible();
    if (canDismiss) onClose();
  };
  return (
    <FrameAwareModal visible={visible} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={closeIfDismissible} statusBarTranslucent>
      <View style={styles.centre}>
        <Pressable
          style={styles.scrim}
          onPress={closeIfDismissible}
          accessibilityLabel={canDismiss ? "Close dialog" : undefined}
          accessible={canDismiss}
          importantForAccessibility={canDismiss ? "auto" : "no-hide-descendants"}
        />
        {visible ? <DialogCard {...cardProps} onClose={closeIfDismissible} canClose={showCloseButton && dismissible && !isBusy} /> : null}
        <KeyboardSpacer restingHeight={0} />
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
      paddingTop: 28,
      paddingBottom: modalSpacing.edge,
      ...buildModalElevation(scheme, palette),
    },
    scrollContent: { paddingHorizontal: modalSpacing.edge, alignItems: "stretch" },
    illustration: { alignItems: "center", marginBottom: 16 },
    iconBadge: { alignSelf: "center", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16 },
    message: { marginTop: 8 },
    children: { marginTop: 16 },
    error: { marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: modalRadius.action, backgroundColor: colors.errorTint },
    errorText: { flex: 1 },
    actions: { marginTop: 20, paddingHorizontal: modalSpacing.edge },
    close: { position: "absolute", top: 6, right: 6, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    closePressed: { backgroundColor: palette.secondaryPressed },
  });
});
