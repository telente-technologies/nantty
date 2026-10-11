import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { inAppBrowserColorsFromTheme, openTrustedWebPage } from "@/components/links/openLink.util";
import { SelectableRow } from "@/components/cart/selectableRow";
import { creatorQueryKeys } from "@/components/creator/creatorQueries.hook";
import { PhotoEvidencePicker } from "@/components/escrow/photoEvidencePicker";
import { Button } from "@/components/ui/button";
import { KeyboardAwareForm } from "@/components/ui/keyboardAwareForm";
import { Chip } from "@/components/ui/chip";
import { Header } from "@/components/ui/header";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { usePayoutAccountsQuery } from "@/components/wallet/walletQueries.hook";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import type { CreatorContentCategory, CreatorSocialLink } from "@/types/creator.type";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

const CREATOR_TERMS_VERSION = "2026-09";
const CONTENT_CATEGORIES: readonly { readonly id: CreatorContentCategory; readonly label: string }[] = [
  { id: "fashion", label: "Fashion" }, { id: "beauty", label: "Beauty" }, { id: "tech", label: "Tech" }, { id: "food", label: "Food" },
  { id: "lifestyle", label: "Lifestyle" }, { id: "comedy", label: "Comedy" }, { id: "music", label: "Music" },
  { id: "education", label: "Education" }, { id: "fitness", label: "Fitness" }, { id: "parenting", label: "Parenting" },
];
const SOCIAL_PLATFORMS: readonly { readonly platform: CreatorSocialLink["platform"]; readonly label: string; readonly placeholder: string }[] = [
  { platform: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
  { platform: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourname" },
  { platform: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourname" },
];
const MAXIMUM_CATEGORIES = 3;

export function CreatorApplicationScreen({ navigation }: MainScreenProps<"CreatorApplication">) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data: payoutAccounts = [] } = usePayoutAccountsQuery();
  const [categories, setCategories] = useState<CreatorContentCategory[]>([]);
  const [socialLinkByPlatform, setSocialLinkByPlatform] = useState<Record<string, string>>({});
  const [sampleContentUrls, setSampleContentUrls] = useState<string[]>([]);
  const [chosenPayoutAccountId, setChosenPayoutAccountId] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [uploadingSample, setUploadingSample] = useState(false);
  const idempotencyKeyForThisApplication = useRef(generateIdempotencyKey());
  const payoutAccountId = chosenPayoutAccountId ?? payoutAccounts[0]?.id ?? null;

  const toggleCategory = (category: CreatorContentCategory) =>
    setCategories((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : current.length < MAXIMUM_CATEGORIES ? [...current, category] : current,
    );

  const submitApplication = useMutation({
    mutationFn: () =>
      creatorProgramService.submitCreatorApplication(
        {
          contentCategories: categories,
          socialLinks: SOCIAL_PLATFORMS.filter(({ platform }) => socialLinkByPlatform[platform]?.trim()).map(({ platform }) => ({ platform, url: socialLinkByPlatform[platform]!.trim() })),
          sampleContentUrls,
          payoutAccountId: payoutAccountId!,
          acceptedCreatorTermsVersion: CREATOR_TERMS_VERSION,
        },
        idempotencyKeyForThisApplication.current,
      ),
    onSuccess: (application) => {
      queryClient.setQueryData(creatorQueryKeys.application, application);
      navigation.replace("CreatorApplicationStatus");
    },
  });

  const readyToSubmit = categories.length > 0 && !!payoutAccountId && acceptedTerms && !uploadingSample;

  return (
    <Screen>
      <Header title="Apply as a creator" />
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        footerStyle={styles.footer}
        footer={
          <>
            {submitApplication.isError ? <Text size={12} lineHeight={16} color={colors.error} align="center">{describeActionFailure(submitApplication.error)}</Text> : null}
            <Button title="Submit application" disabled={!readyToSubmit} loading={submitApplication.isPending} onPress={() => submitApplication.mutate()} />
          </>
        }
      >
        <View style={styles.section}>
          <Text size={16} weight={600} lineHeight={19.2}>What do you create?</Text>
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>Pick up to {MAXIMUM_CATEGORIES}.</Text>
          <View style={styles.chips}>
            {CONTENT_CATEGORIES.map((category) => (
              <Chip key={category.id} kind="topic" label={category.label} selected={categories.includes(category.id)} onPress={() => toggleCategory(category.id)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text size={16} weight={600} lineHeight={19.2}>Your other social accounts (optional)</Text>
          {SOCIAL_PLATFORMS.map((social) => (
            <TextField
              key={social.platform}
              label={social.label}
              placeholder={social.placeholder}
              autoCapitalize="none"
              keyboardType="url"
              value={socialLinkByPlatform[social.platform] ?? ""}
              onChangeText={(url) => setSocialLinkByPlatform((current) => ({ ...current, [social.platform]: url }))}
            />
          ))}
        </View>
        <View style={styles.section}>
          <Text size={16} weight={600} lineHeight={19.2}>Sample content (optional)</Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted}>Screenshots of your best posts help us review faster.</Text>
          <PhotoEvidencePicker photoUrls={sampleContentUrls} onChangePhotoUrls={setSampleContentUrls} maximumPhotos={3} addLabel="Add sample" onUploadingChange={setUploadingSample} />
        </View>
        <View style={styles.section}>
          <Text size={16} weight={600} lineHeight={19.2}>Where should earnings go?</Text>
          {payoutAccounts.map((account) => (
            <SelectableRow key={account.id} selected={account.id === payoutAccountId} onPress={() => setChosenPayoutAccountId(account.id)} accessibilityLabel={`${account.bankName} ${account.accountNumberMasked}`}>
              <Text size={14} lineHeight={16.8}>{account.bankName} {account.accountNumberMasked}</Text>
              <Text size={12} lineHeight={16.8} color={colors.textMuted}>{account.accountName}</Text>
            </SelectableRow>
          ))}
          <Button variant="subtle" title={payoutAccounts.length ? "Use a different account" : "Add a payout account"} onPress={() => navigation.navigate("PayoutAccounts")} />
        </View>
        <SelectableRow selected={acceptedTerms} onPress={() => setAcceptedTerms((value) => !value)} accessibilityLabel="I agree to the Creator Terms">
          <Text size={13} lineHeight={17.5}>
            I agree to the{" "}
            <Text size={13} lineHeight={17.5} color={colors.primary} onPress={() => openTrustedWebPage("https://zudomart.com/creator-terms", inAppBrowserColorsFromTheme(colors))}>Creator Terms</Text>
            , including honest disclosure of sponsored and affiliate content.
          </Text>
        </SelectableRow>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 24 },
  section: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 },
});
