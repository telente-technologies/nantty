import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { BirthdayBalloonsToggle } from "@/components/settings/birthdayBalloonsToggle";
import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { MarketingFrequencyPicker } from "@/components/settings/marketingFrequencyPicker";
import { DataExportSection } from "@/components/settings/dataExportSection";
import { DeleteAccountSheet } from "@/components/settings/deleteAccountSheet";
import { useConsentsQuery, useUpdateConsentMutation } from "@/components/settings/privacyQueries.hook";
import { SettingsCenteredAction, SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { legalLinks } from "@/config/legalLinks.config";
import type { MainScreenProps } from "@/navigation/navigation.types";
import type { ConsentKey } from "@/types";

const CONSENT_OPTIONS: { key: ConsentKey; label: string; description: string }[] = [
  { key: "personalization", label: "Personalization", description: "Use what you view, search and buy to tailor your feed and recommendations." },
  { key: "advertising", label: "Personalized ads", description: "Show ads based on your activity. Turning this off still shows ads, just less relevant." },
  { key: "analytics", label: "Analytics", description: "Share anonymous usage data so we can fix problems and improve Zudomart." },
  { key: "marketing", label: "Marketing messages", description: "Personalised picks from verified sellers, price drops, back in stock, weekly digest." },
];

export function SettingsPrivacyDataScreen({ navigation }: MainScreenProps<"SettingsPrivacyData">) {
  const { colors } = useTheme();
  const consents = useConsentsQuery();
  const updateConsent = useUpdateConsentMutation();
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);

  return (
    <SettingsPage title="Privacy & Data" gap={32}>
      <SettingsGroup>
        <SettingsRow label="Personal information" onPress={() => navigation.navigate("SettingsAccount")} />
        <SettingsRow label="Private profile" onPress={() => navigation.navigate("SettingsPrivacy")} accessibilityHint="Choose who can see your profile" />
      </SettingsGroup>

      <View style={styles.block}>
        <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Your choices</Text>
        {consents.isLoading ? <ListSkeleton /> : null}
        {consents.isError ? <ErrorState message="Couldn't load your privacy choices." onRetry={() => consents.refetch()} /> : null}
        {consents.data
          ? CONSENT_OPTIONS.map((option) => (
              <View key={option.key}>
                <ConsentToggleRow
                  label={option.label}
                  description={option.description}
                  enabled={consents.data.consents[option.key]}
                  onChange={(enabled) => updateConsent.mutate({ key: option.key, enabled })}
                />
                {option.key === "marketing" ? <MarketingFrequencyPicker marketingEnabled={consents.data.consents.marketing} /> : null}
              </View>
            ))
          : null}
        <BirthdayBalloonsToggle />
        {updateConsent.isError ? <Text size={12} lineHeight={14.4} color={colors.error} accessibilityRole="alert">Couldn't save that choice. Try again.</Text> : null}
      </View>

      <DataExportSection />

      <SettingsGroup>
        <SettingsRow label="Privacy Policy" trailing="external" onPress={() => Linking.openURL(legalLinks.privacyPolicy)} />
        <SettingsRow label="Cookie Policy" trailing="external" onPress={() => Linking.openURL(legalLinks.cookiePolicy)} />
        <SettingsRow label="Terms of Service" trailing="external" onPress={() => Linking.openURL(legalLinks.terms)} />
      </SettingsGroup>

      <SettingsCenteredAction label="Delete my account" onPress={() => setDeleteSheetVisible(true)} />
      <DeleteAccountSheet visible={deleteSheetVisible} onClose={() => setDeleteSheetVisible(false)} />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ block: { gap: 4 } });
