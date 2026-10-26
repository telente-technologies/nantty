import { Platform, StyleSheet, View } from "react-native";

import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Text } from "@/components/ui/text";
import { areHomeScreenWidgetsSupported } from "@/services/widgets/widgetNativeBridge.service";
import { useWidgetPreferencesStore } from "@/store/widgetPreferences.store";
import { useTheme } from "@/theme";

const iosSteps = [
  "Touch and hold an empty spot on your Home Screen until the apps jiggle.",
  "Tap Edit, then Add Widget, and search for Nantty.",
  "Pick Orders, Sales today, Live now, Creator stats or Stories, choose a size and tap Add Widget.",
];

const androidSteps = [
  "Touch and hold an empty spot on your home screen.",
  "Tap Widgets and scroll to Nantty.",
  "Drag Orders, Sales today, Live now, Creator stats or Stories onto your home screen.",
];

export function SettingsWidgetsScreen() {
  const { colors } = useTheme();
  const hideAmounts = useWidgetPreferencesStore((s) => s.hideAmounts);
  const setHideAmounts = useWidgetPreferencesStore((s) => s.setHideAmounts);
  const steps = Platform.OS === "ios" ? iosSteps : androidSteps;

  return (
    <SettingsPage title="Widgets" gap={32}>
      <ConsentToggleRow
        label="Hide amounts on widgets"
        description="Sales, balances and earnings show as •••• because widgets can appear on your lock screen. Counts still show."
        enabled={hideAmounts}
        onChange={setHideAmounts}
      />
      <View style={styles.section}>
        <Text size={16} weight={600}>Add a widget</Text>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text size={14} weight={600} color={colors.primary}>{`${index + 1}.`}</Text>
            <Text size={14} lineHeight={20} style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>
          Widgets refresh about every 30 minutes and when you open Nantty. Signing out clears them on this device.
        </Text>
        {areHomeScreenWidgetsSupported() ? null : (
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Widgets need the installed Nantty app. They are not available in this preview.</Text>
        )}
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  step: { flexDirection: "row", gap: 8 },
  stepText: { flex: 1 },
});
