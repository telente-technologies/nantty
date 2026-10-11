import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArrowLeft24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface AuthStepProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly actionTitle: string;
  readonly actionDisabled?: boolean;
  readonly loading?: boolean;
  readonly onAction: () => void;
  readonly right?: ReactNode;
  readonly footer?: ReactNode;
  readonly contentGap?: number;
}

export function AuthStep({
  title,
  subtitle,
  children,
  actionTitle,
  actionDisabled,
  loading,
  onAction,
  right,
  footer,
  contentGap = 24,
}: AuthStepProps) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <Screen>
      <View style={styles.top}>
        {navigation.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft24Icon />
          </Pressable>
        ) : (
          <View />
        )}
        {right}
      </View>
      <KeyboardAwareForm
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={[styles.form, { gap: contentGap }]}>
          {title ? (
            <View style={styles.heading}>
              <Text
                size={16}
                weight={500}
                lineHeight={19.2}
                accessibilityRole="header"
              >
                {title}
              </Text>
              {subtitle ? (
                <Text size={14} lineHeight={16.8} color={colors.textSubtle}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
        <View style={styles.action}>
          {footer}
          <Button
            title={actionTitle}
            onPress={onAction}
            disabled={actionDisabled}
            loading={loading}
          />
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const FORM_HEIGHT_ABOVE_ACTION_BUTTON = 340;

const styles = StyleSheet.create({
  top: {
    height: 24,
    marginTop: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  form: { minHeight: FORM_HEIGHT_ABOVE_ACTION_BUTTON, paddingBottom: 24 },
  heading: { gap: 8 },
  action: { gap: 16 },
});
