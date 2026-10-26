import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { identityVerificationService } from "@/services/auth/identityVerification.service";
import { makeThemedStyles, useTheme } from "@/theme";
import { biometricConsentPoints, describeDocumentType } from "@/utils/identityVerificationCopy.util";

const countries = [{ code: "NG", label: "Nigeria" }, { code: "GH", label: "Ghana" }, { code: "KE", label: "Kenya" }, { code: "ZA", label: "South Africa" }, { code: "GB", label: "United Kingdom" }, { code: "US", label: "United States" }] as const;

export interface IdentityCaptureChoice {
  readonly documentCountry: string;
  readonly documentType: string;
}

export function IdentityConsentStep({ starting, errorMessage, onStart }: { readonly starting: boolean; readonly errorMessage: string | null; readonly onStart: (choice: IdentityCaptureChoice) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [accepted, setAccepted] = useState(false);
  const [country, setCountry] = useState<string>("NG");
  const [documentType, setDocumentType] = useState<string | null>(null);
  const documentCountry = country;
  const documents = useQuery({ queryKey: ["verification", "documentTypes", documentCountry], queryFn: () => identityVerificationService.listDocumentTypes(documentCountry) });

  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2}>Before we check your identity</Text>
      {biometricConsentPoints.map((point) => (
        <Text key={point} size={13} lineHeight={18} color={colors.textMuted}>{point}</Text>
      ))}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.consentRow}>
        <View style={[styles.checkbox, accepted ? styles.checkboxOn : null]} />
        <Text size={14} lineHeight={19} style={styles.consentText}>I agree to Smile ID processing my selfie and ID photo to verify my identity for Nantty.</Text>
      </Pressable>
      <Text size={14} weight={600}>Where was your ID issued?</Text>
      <View style={styles.wrap}>
        {countries.map((item) => <Chip key={item.code} label={item.label} selected={country === item.code} onPress={() => { setCountry(item.code); setDocumentType(null); }} />)}
      </View>
      <Text size={14} weight={600}>Which photo ID will you use?</Text>
      <View style={styles.wrap}>
        {(documents.data?.documentTypes ?? []).map((code) => <Chip key={code} label={describeDocumentType(code)} selected={documentType === code} onPress={() => setDocumentType(code)} />)}
      </View>
      {documents.data?.governmentLookup ? <Text size={12} color={colors.textMuted}>We'll also confirm your ID number with the government database.</Text> : null}
      {errorMessage ? <Text size={13} color={colors.error}>{errorMessage}</Text> : null}
      <Button title="Start selfie and ID check" disabled={!accepted || !documentType} loading={starting} onPress={() => documentType && onStart({ documentCountry, documentType })} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  consentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
  consentText: { flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.textMuted, marginTop: 1 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
