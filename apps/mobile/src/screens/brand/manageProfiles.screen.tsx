import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { BluePremiumProfilesUpsell } from "@/components/profile/bluePremiumProfilesUpsell";
import { PremiumLinkedProfiles } from "@/components/profile/premiumLinkedProfiles";
import { StoreTeamRequestsSection } from "@/components/profile/storeTeamRequestsSection";
import { SettingsGroup, SettingsRow } from "@/components/settings/settingsGroup";
import { SettingsPage } from "@/components/settings/settingsPage";
import { useStepUpPrompt } from "@/components/wallet/stepUpSheet";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { describeActionFailure } from "@/errors/errorExperience/describeError";
import { linkedProfilesQueryKey, useLinkedProfiles } from "@/hooks/useLinkedProfiles.hook";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { brandsService } from "@/services/sellers/brands.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";
import { describeBusinessProfileAllowance, shouldOfferBluePremium, usesPremiumProfileLayout } from "@/utils/businessProfileAllowance.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { brandOf, LINKED_KIND_LABELS, storeOrBusinessOf } from "@/utils/linkedProfiles.util";

export function ManageProfilesScreen({ navigation }: MainScreenProps<"ManageProfiles">) {
  const { colors } = useTheme();
  const linked = useLinkedProfiles();
  if (linked.isPending) return <SettingsPage title="Your profiles"><ListSkeleton rows={4} padding={0} /></SettingsPage>;
  if (linked.isError) return <SettingsPage title="Your profiles"><ErrorState error={linked.error} onRetry={() => linked.refetch()} /></SettingsPage>;
  if (linked.data.choiceRequired) return <ChooseProfilesToKeep linked={linked.data} />;
  if (usesPremiumProfileLayout(linked.data)) {
    return (
      <SettingsPage title="Your profiles" gap={24}>
        <StoreTeamRequestsSection />
        <PremiumLinkedProfiles
          linked={linked.data}
          onOpenProfile={(item) => (item.storeId ? navigation.navigate("Store", { storeId: item.storeId }) : item.kind === "brand" ? navigation.navigate("BrandProfile", { brandId: item.profileId }) : undefined)}
          onOpenStore={() => navigation.navigate("SellerApplication")}
          onCreateBusiness={() => navigation.navigate("CreateBusinessProfile")}
          onCreateBrand={() => navigation.navigate("CreateBrand")}
        />
      </SettingsPage>
    );
  }
  const allowanceText = describeBusinessProfileAllowance(linked.data.businessProfiles);
  const storeOrBusiness = storeOrBusinessOf(linked.data);
  const brand = brandOf(linked.data);
  return (
    <SettingsPage title="Your profiles" gap={24}>
      <StoreTeamRequestsSection />
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        Your account can have one Store or one Business page, never both, plus one Brand.
      </Text>
      {allowanceText ? <Text size={14} weight={500}>{allowanceText}</Text> : null}
      <View style={sectionStyles.section}>
        <Text size={14} weight={500}>Store or Business page</Text>
        {storeOrBusiness ? (
          <SettingsGroup>
            <SettingsRow label={`You already have a ${LINKED_KIND_LABELS[storeOrBusiness.kind]}`} trailing={{ text: storeOrBusiness.name || "Pending review" }} onPress={storeOrBusiness.storeId ? () => navigation.navigate("Store", { storeId: storeOrBusiness.storeId! }) : undefined} />
          </SettingsGroup>
        ) : (
          <SettingsGroup>
            <SettingsRow label="Open a store" trailing={{ text: "Sell in Mart" }} accessibilityHint="Your profile shows the Mart icon and a products tab." onPress={() => navigation.navigate("SellerApplication")} />
            <SettingsRow label="Create a Business page" trailing={{ text: "No shop" }} accessibilityHint="For organisations that don't sell. No Mart icon or products." onPress={() => navigation.navigate("CreateBusinessProfile")} />
          </SettingsGroup>
        )}
        {storeOrBusiness ? null : <Text size={12} lineHeight={16} color={colors.textMuted}>Pick one. Once you have a Store you can't add a Business page, and the other way round.</Text>}
      </View>
      <View style={sectionStyles.section}>
        <Text size={14} weight={500}>Brand</Text>
        <SettingsGroup>
          {brand ? (
            <SettingsRow label="You already have a Brand" trailing={{ text: brand.name }} onPress={() => navigation.navigate("BrandProfile", { brandId: brand.profileId })} />
          ) : (
            <SettingsRow label="Create a brand" onPress={() => navigation.navigate("CreateBrand")} />
          )}
        </SettingsGroup>
      </View>
      {shouldOfferBluePremium(linked.data) ? <BluePremiumProfilesUpsell /> : null}
    </SettingsPage>
  );
}

function ChooseProfilesToKeep({ linked }: { readonly linked: LinkedProfiles }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { withStepUp, stepUpSheet } = useStepUpPrompt();
  const candidates = linked.items.filter((item) => item.status !== "retired");
  const slotOptions = candidates.filter((item) => item.kind !== "brand");
  const brandOptions = candidates.filter((item) => item.kind === "brand");
  const [slot, setSlot] = useState<string | null>(slotOptions.find((item) => item.status === "active")?.profileId ?? null);
  const [brand, setBrand] = useState<string | null>(brandOptions.find((item) => item.status === "active")?.profileId ?? null);
  const choose = useMutation({
    mutationFn: () => withStepUp((token) => brandsService.chooseLinkedProfiles([slot, brand].filter((id): id is string => id !== null), token)),
    onSuccess: (summary) => {
      queryClient.setQueryData(linkedProfilesQueryKey, summary);
      queryClient.invalidateQueries({ queryKey: ["users", "me", "profiles"] });
    },
  });
  const confirm = () =>
    showAlertWithButtons("Keep these profiles?", "The profiles you don't keep stay visible but can't post or list anything new. Open orders and payouts carry on.", [
      { text: "Cancel", style: "cancel" },
      { text: "Keep", onPress: () => choose.mutate() },
    ]);
  return (
    <SettingsPage title="Choose which to keep" gap={24}>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        Your account has more profiles than the rule allows: one Store or one Business page, plus one Brand. Nothing is deleted. Until you choose, the extra profiles can't post or add listings.
      </Text>
      {slotOptions.length > 0 ? <ChoiceGroup title="Store or Business page" options={slotOptions} selected={slot} onSelect={setSlot} /> : null}
      {brandOptions.length > 0 ? <ChoiceGroup title="Brand" options={brandOptions} selected={brand} onSelect={setBrand} /> : null}
      {choose.isError ? <Text size={12} color={colors.error} align="center">{describeActionFailure(choose.error)}</Text> : null}
      <Button title="Keep selected profiles" loading={choose.isPending} onPress={confirm} />
      {stepUpSheet}
    </SettingsPage>
  );
}

function ChoiceGroup({ title, options, selected, onSelect }: { readonly title: string; readonly options: readonly LinkedProfileItem[]; readonly selected: string | null; readonly onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={sectionStyles.section} accessibilityRole="radiogroup">
      <Text size={14} weight={500}>{title}</Text>
      {options.map((option) => {
        const checked = option.profileId === selected;
        return (
          <Pressable key={option.profileId} accessibilityRole="radio" accessibilityState={{ checked }} onPress={() => onSelect(option.profileId)} style={[styles.option, checked ? styles.optionChecked : null]}>
            <View style={sectionStyles.texts}>
              <Text size={14} weight={500}>{option.name || "Untitled"}</Text>
              <Text size={12} color={colors.textMuted}>{LINKED_KIND_LABELS[option.kind]}{option.handle ? ` · @${option.handle}` : ""}</Text>
            </View>
            <View style={[styles.radio, checked ? styles.radioOn : null]}>{checked ? <Check16Icon size={12} color={colors.onPrimary} /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  section: { gap: 8 },
  texts: { flex: 1, gap: 2 },
});

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.divider },
  optionChecked: { borderColor: colors.primarySolid, backgroundColor: colors.primaryTint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.primarySolid, backgroundColor: colors.primarySolid },
}));
