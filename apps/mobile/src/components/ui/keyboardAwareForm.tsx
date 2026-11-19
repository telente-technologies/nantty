import { useState, type ReactElement, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

import { dismissKeyboardIfVisible, KEYBOARD_DISMISS_ON_DRAG } from "./dismissKeyboardOnEmptyTap.util";
import { FOCUSED_INPUT_BOTTOM_GAP, useKeepFocusedInputVisible } from "./keepFocusedInputVisible.hook";
import { keyboardImplementation } from "./keyboardController";
import { KeyboardFloatingFooter } from "./keyboardStickyFooter";
import { Screen } from "./screen";

export interface KeyboardAwareFormProps {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly footerStyle?: StyleProp<ViewStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly bottomOffset?: number;
  readonly safeAreaHandledByParent?: boolean;
  readonly refreshControl?: ReactElement<RefreshControlProps>;
  readonly showsVerticalScrollIndicator?: boolean;
  readonly bounces?: boolean;
  readonly keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
  readonly testID?: string;
}

export function KeyboardAwareForm({
  children,
  footer,
  footerStyle,
  style,
  contentContainerStyle,
  bottomOffset = FOCUSED_INPUT_BOTTOM_GAP,
  safeAreaHandledByParent = false,
  refreshControl,
  showsVerticalScrollIndicator,
  bounces,
  keyboardDismissMode = KEYBOARD_DISMISS_ON_DRAG,
  testID,
}: KeyboardAwareFormProps) {
  const { colors } = useTheme();
  const [footerHeight, setFooterHeight] = useState(0);
  const resolvedFooterStyle = [{ backgroundColor: colors.background }, footerStyle];
  const NativeAwareScrollView = keyboardImplementation.KeyboardAwareScrollView;
  const scrollProps: ScrollViewProps = {
    testID,
    style: styles.flex,
    contentContainerStyle: styles.grow,
    refreshControl,
    showsVerticalScrollIndicator,
    bounces,
    keyboardDismissMode,
    keyboardShouldPersistTaps: "handled",
  };
  const dismissableContent = (
    <Pressable accessible={false} onPress={dismissKeyboardIfVisible} style={[styles.grow, contentContainerStyle]}>
      {children}
    </Pressable>
  );
  const footerNode = footer ? (
    <KeyboardFloatingFooter style={resolvedFooterStyle} safeAreaHandledByParent={safeAreaHandledByParent} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
      {footer}
    </KeyboardFloatingFooter>
  ) : null;

  if (NativeAwareScrollView) {
    return (
      <View style={[styles.flex, style]}>
        <NativeAwareScrollView {...scrollProps} bottomOffset={bottomOffset + footerHeight}>
          {dismissableContent}
        </NativeAwareScrollView>
        {footerNode}
      </View>
    );
  }
  return (
    <FallbackKeyboardAwareForm scrollProps={scrollProps} bottomOffset={bottomOffset} style={style} footer={footer} footerStyle={resolvedFooterStyle} safeAreaHandledByParent={safeAreaHandledByParent}>
      {dismissableContent}
    </FallbackKeyboardAwareForm>
  );
}

interface FallbackKeyboardAwareFormProps {
  readonly children: ReactNode;
  readonly scrollProps: ScrollViewProps;
  readonly bottomOffset: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly footer?: ReactNode;
  readonly footerStyle?: StyleProp<ViewStyle>;
  readonly safeAreaHandledByParent: boolean;
}

function FallbackKeyboardAwareForm({ children, scrollProps, bottomOffset, style, footer, footerStyle, safeAreaHandledByParent }: FallbackKeyboardAwareFormProps) {
  const insets = useSafeAreaInsets();
  const visibility = useKeepFocusedInputVisible({ bottomGap: bottomOffset });
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.flex, style]} testID="keyboard-aware-form-fallback">
      <ScrollView {...scrollProps} {...visibility.scrollProps}>
        {children}
      </ScrollView>
      {footer ? <View style={[footerStyle, { paddingBottom: safeAreaHandledByParent ? 0 : insets.bottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export interface KeyboardScrollScreenProps extends KeyboardAwareFormProps {
  readonly header?: ReactNode;
  readonly background?: string;
  readonly edges?: readonly Edge[];
}

export function KeyboardScrollScreen({ header, background, edges = ["top"], ...form }: KeyboardScrollScreenProps) {
  return (
    <Screen background={background} edges={edges}>
      {header}
      <KeyboardAwareForm {...form} safeAreaHandledByParent={form.safeAreaHandledByParent ?? edges.includes("bottom")} />
    </Screen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, grow: { flexGrow: 1 } });
