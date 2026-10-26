import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { categoriesService } from "@/services/catalog/categories.service";
import type { SellerApplicationDraft } from "@/types/account.type";

import { IDENTITY_DOCUMENT_OPTIONS } from "./applicationIdentityStep";
import { maskAllButLastFourCharacters } from "./maskSensitiveNumber.util";

export function ApplicationReviewStep({ draft, onEditStep }: { draft: SellerApplicationDraft; onEditStep: (stepIndex: number) => void }) {
  const { colors } = useTheme();
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesService.fetchProductCategories });
  const categoryName = categories.data?.find((category) => category.id === draft.categoryId)?.name ?? "";
  const documentLabel = IDENTITY_DOCUMENT_OPTIONS.find((option) => option.id === draft.identityDocumentType)?.label ?? "";
  const muted = { color: colors.textMuted, weight: 400 as const };
  return (
    <View style={styles.root}>
      <SettingsGroup>
        <SettingsRow label="Store" trailing={{ text: draft.storeName, ...muted }} onPress={() => onEditStep(0)} />
        <SettingsRow label="Category" trailing={{ text: categoryName, ...muted }} onPress={() => onEditStep(0)} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Phone" trailing={{ text: draft.phone, ...muted }} onPress={() => onEditStep(1)} />
        <SettingsRow label="Location" trailing={{ text: `${draft.city}, ${draft.state}`, ...muted }} onPress={() => onEditStep(1)} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label={documentLabel || "ID document"} trailing={{ text: maskAllButLastFourCharacters(draft.identityDocumentNumber), ...muted }} onPress={() => onEditStep(2)} />
        <SettingsRow label="Document photo" trailing={{ text: draft.identityDocumentPhotoUrl ? "Added" : "Missing", color: draft.identityDocumentPhotoUrl ? colors.success : colors.error }} onPress={() => onEditStep(2)} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label={draft.payoutBankName || "Bank"} trailing={{ text: maskAllButLastFourCharacters(draft.payoutAccountNumber), ...muted }} onPress={() => onEditStep(3)} />
        <SettingsRow label="Account name" trailing={{ text: draft.payoutAccountName, ...muted }} onPress={() => onEditStep(3)} />
      </SettingsGroup>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        By submitting, you confirm the details are yours and agree to the Nantty Seller Terms. We usually review applications within 2 working days.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: 16 } });
