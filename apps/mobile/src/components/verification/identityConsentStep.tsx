import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { GeoPickerField } from "@/components/settings/geoPickerField";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { identityVerificationService } from "@/services/auth/identityVerification.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { availableIdentityVerificationMethods, biometricConsentPoints, describeDocumentType, sortIdentityCountries } from "@/utils/identityVerificationCopy.util";

export interface IdentityCaptureChoice {
  readonly verificationMethod: "document" | "id_number";
  readonly verificationProduct: "document_verification" | "enhanced_document_verification" | "enhanced_kyc";
  readonly documentCountry: string;
  readonly documentType: string;
}

export function IdentityConsentStep({ starting, errorMessage, privacyPolicyUrl, onStart }: { readonly starting: boolean; readonly errorMessage: string | null; readonly privacyPolicyUrl: string; readonly onStart: (choice: IdentityCaptureChoice) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [consentedSelection, setConsentedSelection] = useState("");
  const [country, setCountry] = useState<string>("");
  const [product, setProduct] = useState<IdentityCaptureChoice["verificationProduct"]>("document_verification");
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState("");
  const countries = useQuery({ queryKey: ["verification", "documentCountries"], queryFn: identityVerificationService.listDocumentCountries });
  const countryOptions = countries.isError ? [] : sortIdentityCountries(countries.data?.countries ?? []);
  const documentCountry = countryOptions.some((item) => item.code === country) ? country : "";
  const documents = useQuery({ queryKey: ["verification", "documentTypes", documentCountry], queryFn: () => identityVerificationService.listDocumentTypes(documentCountry), enabled: Boolean(documentCountry) });
  const countryTypes = !documents.isError && documents.data?.country === documentCountry ? documents.data : undefined;
  const methodOptions = availableIdentityVerificationMethods(countryTypes);
  const activeOption = methodOptions.find((option) => option.verificationProduct === product) ?? methodOptions[0];
  const activeProduct = activeOption?.verificationProduct ?? product;
  const activeMethod = activeOption?.verificationMethod ?? "document";
  const canUseDocuments = methodOptions.some((option) => option.verificationProduct === "document_verification");
  const canUseEnhancedDocuments = methodOptions.some((option) => option.verificationProduct === "enhanced_document_verification");
  const canUseIdNumber = methodOptions.some((option) => option.verificationProduct === "enhanced_kyc");
  const anyMethodAvailable = methodOptions.length > 0;
  const options = (activeOption?.types ?? []).map((item) => ({ code: item.code, name: describeDocumentType(item.code, item.name) })).sort((left, right) => left.name.localeCompare(right.name));
  const visibleOptions = options.filter(({ code, name }) => `${name} ${code}`.toLowerCase().includes(typeSearch.trim().toLowerCase()));
  const selectedDocumentType = options.some(({ code }) => code === documentType) ? documentType : null;
  const selectionKey = `${documentCountry}:${activeProduct}:${selectedDocumentType ?? ""}`;
  const accepted = consentedSelection === selectionKey;

  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2}>Before we check your identity</Text>
      {biometricConsentPoints.map((point) => (
        <Text key={point} size={13} lineHeight={18} color={colors.textMuted}>{point}</Text>
      ))}
      <Text size={13} color={colors.link} accessibilityRole="link" onPress={() => void Linking.openURL(privacyPolicyUrl).catch(() => undefined)}>Read Nantty&apos;s privacy policy</Text>
      <Text size={12} lineHeight={17} color={colors.textMuted}>Choose the country that issued your ID. Nantty lists photo IDs and ID-number checks separately. Options come from Smile ID&apos;s worldwide catalog and are filtered to the products and ID types enabled for Nantty&apos;s partner account. Availability can differ by country and account activation; if your ID is missing, contact support rather than choosing a different ID.</Text>
      <Text size={14} weight={600}>Which country is your ID from?</Text>
      {countries.isLoading ? <Text size={12} color={colors.textMuted}>Loading available countries…</Text> : null}
      {countries.data?.catalogSource === "preview" ? <Text size={12} lineHeight={17} color={colors.textMuted} accessibilityRole="text">Preview options only. Live countries, ID types, and product availability are confirmed by Smile ID for Nantty&apos;s partner account.</Text> : null}
      {countries.isError ? <View style={styles.errorBlock}><Text size={12} color={colors.error}>We couldn&apos;t load supported countries. Try again.</Text><Button title="Retry" variant="subtle" onPress={() => void countries.refetch()} /></View> : null}
      {!countries.isLoading && !countries.isError && countries.data?.countries.length === 0 ? <Text size={12} color={colors.textMuted}>Identity checks are not enabled for this Nantty account yet. Please try again later.</Text> : null}
      {countryOptions.length ? <GeoPickerField label="Issuing country" options={countryOptions.map((item) => ({ id: item.code, name: item.name, searchText: item.code }))} selectedId={documentCountry} onSelect={(item) => { setCountry(item.id); setProduct("document_verification"); setDocumentType(null); setTypeSearch(""); }} /> : null}
      {documents.isLoading ? <Text size={12} color={colors.textMuted}>Loading verification methods…</Text> : null}
      {countryTypes?.catalogSource === "preview" ? <Text size={12} lineHeight={17} color={colors.textMuted} accessibilityRole="text">These are sample ID options for preview; they do not confirm that Smile ID has enabled this check for Nantty.</Text> : null}
      {documents.isError ? <View style={styles.errorBlock}><Text size={12} color={colors.error}>We couldn&apos;t load verification methods for this country. Try again.</Text><Button title="Retry" variant="subtle" onPress={() => void documents.refetch()} /></View> : null}
      {countryTypes && anyMethodAvailable ? <>
        <Text size={14} weight={600}>Choose a verification method</Text>
        <View style={styles.wrap}>
          {canUseDocuments ? <Chip label="Selfie + photo of ID" selected={activeProduct === "document_verification"} onPress={() => { setProduct("document_verification"); setDocumentType(null); setTypeSearch(""); }} /> : null}
          {canUseEnhancedDocuments ? <Chip label="Selfie + photo ID with authority check" selected={activeProduct === "enhanced_document_verification"} onPress={() => { setProduct("enhanced_document_verification"); setDocumentType(null); setTypeSearch(""); }} /> : null}
          {canUseIdNumber ? <Chip label="ID number (secure Smile ID check)" selected={activeProduct === "enhanced_kyc"} onPress={() => { setProduct("enhanced_kyc"); setDocumentType(null); setTypeSearch(""); }} /> : null}
        </View>
        <Text size={12} lineHeight={17} color={colors.textMuted}>{activeProduct === "document_verification" ? "Smile ID compares your selfie with a photo of the ID you select." : activeProduct === "enhanced_document_verification" ? "Smile ID checks eligible document details with the issuing authority. Only documents enabled for Nantty's partner account are listed." : "You enter the ID number on Smile ID's secure page. Nantty does not ask you to type the number here."}</Text>
        {countryTypes.enhancedDocumentEntitlementStatus === "unavailable" ? <Text size={12} lineHeight={17} color={colors.textMuted} accessibilityRole="text">We couldn&apos;t confirm which authority-check IDs are enabled right now. You can use another available method or try again later.</Text> : null}
        <Text size={14} weight={600}>{activeProduct === "enhanced_document_verification" ? "Select your authority-check ID type" : activeMethod === "document" ? "Select your photo ID type" : "Select your ID-number type"}</Text>
        <View style={styles.wrap}>
          {options.length > 0 ? <TextField style={styles.typeSearch} placeholder="Search available ID types" value={typeSearch} onChangeText={setTypeSearch} autoCorrect={false} accessibilityLabel="Search available ID types" /> : null}
          {visibleOptions.map((item) => <Chip key={item.code} label={item.name || describeDocumentType(item.code)} selected={selectedDocumentType === item.code} onPress={() => setDocumentType(item.code)} />)}
          {options.length > 0 && visibleOptions.length === 0 ? <Text size={12} color={colors.textMuted}>No ID types match that search.</Text> : null}
        </View>
      </> : null}
      {documents.isSuccess && countryTypes && !anyMethodAvailable ? <Text size={12} color={colors.textMuted}>No enabled Smile ID verification method is available for this country.</Text> : null}
      {canUseIdNumber && activeMethod === "id_number" ? <Text size={12} lineHeight={17} color={colors.textMuted}>ID-number options are country-specific. For example, Nigeria may offer NIN, NIN Slip, or Virtual NIN when enabled. You enter the number on Smile ID&apos;s secure page—not in Nantty. Only the checks configured for Nantty and available to its Smile ID partner account are shown.</Text> : null}
      {anyMethodAvailable ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setConsentedSelection(accepted ? "" : selectionKey)} style={styles.consentRow}>
        <View style={[styles.checkbox, accepted ? styles.checkboxOn : null]} />
        <Text size={14} lineHeight={19} style={styles.consentText}>
          {activeProduct === "enhanced_document_verification"
            ? "I agree to Smile ID processing my selfie and photo ID and checking the document details with the issuing authority for Nantty verification."
            : activeMethod === "id_number"
            ? "I agree to Smile ID checking the ID number I provide through its secure page for Nantty verification."
            : "I agree to Smile ID processing my selfie and photo ID for Nantty verification."}
        </Text>
      </Pressable> : null}
      {errorMessage ? <Text size={13} color={colors.error}>{errorMessage}</Text> : null}
      <Button title="Continue to identity check" disabled={!accepted || !selectedDocumentType || !options.some(({ code }) => code === selectedDocumentType)} loading={starting} onPress={() => selectedDocumentType && onStart({ verificationMethod: activeMethod, verificationProduct: activeProduct, documentCountry, documentType: selectedDocumentType })} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  errorBlock: { gap: 8, alignItems: "flex-start" },
  consentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
  consentText: { flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.textMuted, marginTop: 1 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeSearch: { width: "100%" },
}));
