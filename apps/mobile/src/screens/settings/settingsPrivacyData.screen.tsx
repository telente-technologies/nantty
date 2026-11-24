import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { BirthdayBalloonsToggle } from "@/components/settings/birthdayBalloonsToggle";
import { ConsentToggleRow } from "@/components/settings/consentToggleRow";
import { MarketingFrequencyPicker } from "@/components/settings/marketingFrequencyPicker";
import { DataExportSection } from "@/components/settings/dataExportSection";
import { DeleteAccountSheet } from "@/components/settings/deleteAccountSheet";
import { useAccountDeletionStatusQuery, useCancelAccountDeletionMutation, useConsentsQuery, useUpdateConsentMutation } from "@/components/settings/privacyQueries.hook";
import { Button } from "@/components/ui/button";
import { SettingsCenteredAction, SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { Cookie24Icon, EyeSlash24Icon, FileLock24Icon, IdentificationCard24Icon, Scales24Icon, Trash24Icon } from "@/components/icons";
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
  { key: "analytics", label: "Analytics", description: "Share anonymous usage data so we can fix problems and improve Nantty." },
  { key: "marketing", label: "Marketing messages", description: "Personalised picks from verified sellers, price drops, back in stock, weekly digest." },
];

export function SettingsPrivacyDataScreen({ navigation }: MainScreenProps<"SettingsPrivacyData">) {
  const { colors } = useTheme();
  const consents = useConsentsQuery();
  const updateConsent = useUpdateConsentMutation();
  const deletionStatus = useAccountDeletionStatusQuery();
  const cancelDeletion = useCancelAccountDeletionMutation();
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);

  return (
    <SettingsPage title="Privacy & Data" gap={32}>
      <SettingsGroup>
        <SettingsRow label="Personal information" icon={<IdentificationCard24Icon />} onPress={() => navigation.navigate("SettingsAccount")} />
        <SettingsRow label="Private profile" icon={<EyeSlash24Icon />} onPress={() => navigation.navigate("SettingsPrivacy")} accessibilityHint="Choose who can see your profile" />
      </SettingsGroup>

      <View style={styles.block}>
        <Text size={14} weight={600} lineHeight={16.8} accessibilityRole="header">Your choices</Text>
        {consents.isLoading ? <ListSkeleton /> : null}
        {consents.isError ? <ErrorState error={consents.error} message="Couldn't load your privacy choices." onRetry={() => consents.refetch()} /> : null}
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
        <SettingsRow label="Privacy Policy" icon={<FileLock24Icon />} trailing="external" onPress={() => openTrustedWebPage(legalLinks.privacyPolicy, inAppBrowserColorsFromTheme(colors))} />
        <SettingsRow label="Cookie Policy" icon={<Cookie24Icon />} trailing="external" onPress={() => openTrustedWebPage(legalLinks.cookiePolicy, inAppBrowserColorsFromTheme(colors))} />
        <SettingsRow label="Terms of Service" icon={<Scales24Icon />} trailing="external" onPress={() => openTrustedWebPage(legalLinks.terms, inAppBrowserColorsFromTheme(colors))} />
        <SettingsRow label="Data rights requests" icon={<FileLock24Icon />} trailing="external" onPress={() => openTrustedWebPage(legalLinks.dataRights, inAppBrowserColorsFromTheme(colors))} />
      </SettingsGroup>

      {deletionStatus.data ? (
        <View style={styles.deletionBanner}>
          <Text size={13} lineHeight={18} color={colors.textMuted}>
            Account scheduled for deletion on {new Date(deletionStatus.data.scheduledFor).toLocaleDateString()}.
          </Text>
          {cancelDeletion.isError ? (
            <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">
              Couldn&apos;t cancel deletion right now. Try again.
            </Text>
          ) : null}
          <Button
            title={cancelDeletion.isPending ? "Cancelling…" : "Cancel scheduled deletion"}
            variant="outline"
            disabled={cancelDeletion.isPending}
            onPress={() => cancelDeletion.mutate()}
          />
        </View>
      ) : (
        <SettingsCenteredAction label="Delete my account" icon={<Trash24Icon size={20} color={colors.error} />} onPress={() => setDeleteSheetVisible(true)} />
      )}
      <DeleteAccountSheet visible={deleteSheetVisible} onClose={() => setDeleteSheetVisible(false)} />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({ block: { gap: 4 }, deletionBanner: { gap: 10 } });
