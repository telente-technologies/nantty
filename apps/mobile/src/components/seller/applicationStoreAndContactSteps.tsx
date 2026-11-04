import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { OptionSelect } from "@/components/product/optionSelect";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { categoriesService } from "@/services/catalog/categories.service";
import type { SellerApplicationDraft } from "@/types/account.type";

import { NIGERIAN_STATES } from "./nigerianStates.constant";

export interface ApplicationStepProps {
  readonly draft: SellerApplicationDraft;
  readonly onChange: (patch: Partial<SellerApplicationDraft>) => void;
}

export function ApplicationStoreStep({ draft, onChange }: ApplicationStepProps) {
  const { colors } = useTheme();
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoriesService.fetchProductCategories });
  return (
    <View style={styles.fields}>
      <TextField label="Store name" placeholder="e.g. Ada's Fabric House" value={draft.storeName} onChangeText={(storeName) => onChange({ storeName })} maxLength={40} />
      <View style={styles.group}>
        <Text size={14} lineHeight={16.8}>What will you sell?</Text>
        <View style={styles.chips}>
          {(categories.data ?? []).map((category) => (
            <Chip key={category.id} kind="topic" label={category.name} selected={draft.categoryId === category.id} onPress={() => onChange({ categoryId: category.id })} />
          ))}
        </View>
      </View>
      <TextField
        label="About your store"
        placeholder="What makes your products special? Buyers see this on your store page."
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        maxLength={300}
        boxStyle={styles.multiline}
      />
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{draft.description.length}/300</Text>
    </View>
  );
}

export function ApplicationContactStep({ draft, onChange }: ApplicationStepProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.fields}>
      <TextField
        label="Business phone number"
        placeholder="0803 441 7720"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={draft.phone}
        onChangeText={(phone) => onChange({ phone: phone.replace(/[^\d+\s]/g, "") })}
      />
      <TextField label="Pickup address" placeholder="House number and street" value={draft.addressLine} onChangeText={(addressLine) => onChange({ addressLine })} autoComplete="street-address" />
      <TextField label="City or town" placeholder="e.g. Ikeja" value={draft.city} onChangeText={(city) => onChange({ city })} />
      <OptionSelect label="State" placeholder="Choose your state" options={NIGERIAN_STATES} value={draft.state || null} onChange={(state) => onChange({ state })} />
      <View style={styles.group}>
        <Text size={14} lineHeight={18}>Can your store handle order logistics?</Text>
        <View style={styles.chips}>
          <Chip kind="topic" label="Yes, we can" selected={draft.logisticsChoiceConfirmed && draft.logisticsEnabled} onPress={() => onChange({ logisticsEnabled: true, logisticsChoiceConfirmed: true })} />
          <Chip kind="topic" label="Not yet" selected={draft.logisticsChoiceConfirmed && !draft.logisticsEnabled} onPress={() => onChange({ logisticsEnabled: false, logisticsChoiceConfirmed: true })} />
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          This records your store’s capability for review. It does not activate a third-party courier. Your and your buyers’ email addresses are not shared with logistics providers.
        </Text>
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        Couriers collect orders from this address. Buyers only see your city and state.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  group: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  multiline: { height: 110, alignItems: "flex-start", paddingVertical: 12 },
});
